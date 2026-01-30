const path = require("path");

const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

// ────────────────────────────────────────────────
// S3 CLIENT SETUP
// ────────────────────────────────────────────────
const region =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-1";
const bucket = process.env.AWS_S3_BUCKET;

// Warn if bucket not set
if (!bucket) {
  console.warn(
    "AWS_S3_BUCKET is not set. S3 operations will fail until configured.",
  );
}

// Create S3 client
const s3Client = new S3Client({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

// ────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ────────────────────────────────────────────────
function sanitizeKey(key) {
  if (!key) return "";
  // Remove leading/trailing slashes, prevent path traversal
  return key.replace(/^\/+/, "").replace(/\.\.+/g, "").replace(/\\/g, "/");
}

/**
 * Generate unique object key with optional jobId prefix (folder)
 * @param {string} [originalName=""] - Original filename to preserve extension
 * @param {string} [jobId=""] - If provided, prefix key with jobId/
 * @returns {string} e.g. "507f191e810c19729de860ea/uuid.jpg"
 */
function generateKey(originalName = "", folderPrefix = "") {
  const ext = path.extname(originalName || "") || "";
  const uniquePart = `${uuidv4()}${ext}`;

  if (folderPrefix) {
    const cleanPrefix = sanitizeKey(folderPrefix);
    return cleanPrefix ? `${cleanPrefix}/${uniquePart}` : uniquePart;
  }
  return uniquePart;
}

// ────────────────────────────────────────────────
// SINGLE FILE FUNCTIONS
// ────────────────────────────────────────────────

/**
 * Upload buffer with optional jobId folder
 * @param {Buffer} buffer
 * @param {string} [key] - Custom key (overrides auto-generated)
 * @param {string} [contentType]
 * @param {string} [jobId] - If provided & no custom key, uses jobId/ prefix
 */
async function uploadBuffer(buffer, key, contentType, folderPrefix = "") {
  if (!bucket) throw new Error("S3 bucket not configured");

  const finalKey = key ? sanitizeKey(key) : generateKey("", folderPrefix);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: finalKey,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    },
  });

  const result = await upload.done();

  return {
    Bucket: bucket,
    Key: finalKey,
    ETag: result.ETag,
    Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(finalKey)}`,
  };
}

/**
 * Upload stream with optional jobId folder
 * Same logic as uploadBuffer
 */
async function uploadStream(stream, key, contentType, folderPrefix = "") {
  if (!bucket) throw new Error("S3 bucket not configured");

  const finalKey = key ? sanitizeKey(key) : generateKey("", folderPrefix);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: finalKey,
      Body: stream,
      ContentType: contentType || "application/octet-stream",
    },
  });

  const result = await upload.done();

  return {
    Bucket: bucket,
    Key: finalKey,
    ETag: result.ETag,
    Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(finalKey)}`,
  };
}

async function deleteObject(key) {
  if (!bucket) throw new Error("S3 bucket not configured");
  const safeKey = sanitizeKey(key);
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: safeKey });
  return s3Client.send(cmd);
}

async function getObjectStream(key) {
  if (!bucket) throw new Error("S3 bucket not configured");
  const safeKey = sanitizeKey(key);
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: safeKey });
  const res = await s3Client.send(cmd);
  return res.Body;
}

async function getSignedDownloadUrl(key, expiresIn = 900) {
  if (!bucket) throw new Error("S3 bucket not configured");
  const safeKey = sanitizeKey(key);
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: safeKey });
  return getSignedUrl(s3Client, cmd, { expiresIn });
}

// ────────────────────────────────────────────────
// BATCH / MULTIPLE FILE FUNCTIONS
// ────────────────────────────────────────────────

/**
 * Upload multiple buffers – now supports jobId per item
 * @param {Array<{ buffer: Buffer, key?: string, contentType?: string, originalName?: string, jobId?: string }>} items
 */
async function uploadBuffers(items, concurrency = 5) {
  if (!bucket) throw new Error("S3 bucket not configured");
  if (!Array.isArray(items) || items.length === 0) return [];

  const results = new Array(items.length);
  const queue = items.map((it, ix) => ({ item: it, ix }));

  async function processNext() {
    while (queue.length > 0) {
      const { item, ix } = queue.shift();
      try {
        const safeKey = sanitizeKey(
          item.key ||
            generateKey(item.originalName || "", item.folderPrefix || ""),
        );
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucket,
            Key: safeKey,
            Body: item.buffer,
            ContentType: item.contentType || "application/octet-stream",
          },
        });

        const result = await upload.done();

        results[ix] = {
          status: "fulfilled",
          value: {
            Bucket: bucket,
            Key: safeKey,
            ETag: result.ETag,
            Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(safeKey)}`,
          },
        };
      } catch (err) {
        results[ix] = { status: "rejected", reason: err };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => processNext(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Upload multiple streams – supports jobId per item
 */
async function uploadStreams(items, concurrency = 5) {
  if (!bucket) throw new Error("S3 bucket not configured");
  if (!Array.isArray(items) || items.length === 0) return [];

  const results = new Array(items.length);
  const queue = items.map((it, ix) => ({ item: it, ix }));

  async function processNext() {
    while (queue.length > 0) {
      const { item, ix } = queue.shift();
      try {
        const safeKey = sanitizeKey(
          item.key ||
            generateKey(item.originalName || "", item.folderPrefix || ""),
        );
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucket,
            Key: safeKey,
            Body: item.stream,
            ContentType: item.contentType || "application/octet-stream",
          },
        });

        const result = await upload.done();

        results[ix] = {
          status: "fulfilled",
          value: {
            Bucket: bucket,
            Key: safeKey,
            ETag: result.ETag,
            Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(safeKey)}`,
          },
        };
      } catch (err) {
        results[ix] = { status: "rejected", reason: err };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => processNext(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Delete multiple objects (batched)
 */
async function deleteObjects(keys) {
  if (!bucket) throw new Error("S3 bucket not configured");
  if (!keys || keys.length === 0) return { Deleted: [], Errors: [] };

  const safeKeys = keys.map(sanitizeKey).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < safeKeys.length; i += 1000) {
    chunks.push(safeKeys.slice(i, i + 1000));
  }

  const finalResult = { Deleted: [], Errors: [] };

  for (const chunk of chunks) {
    const cmd = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: chunk.map((Key) => ({ Key })),
        Quiet: false,
      },
    });

    const response = await s3Client.send(cmd);
    if (response.Deleted) finalResult.Deleted.push(...(response.Deleted || []));
    if (response.Errors) finalResult.Errors.push(...(response.Errors || []));
  }

  return finalResult;
}

// ────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────

module.exports = {
  uploadBuffer,
  uploadBuffers,
  uploadStream,
  uploadStreams,
  deleteObject,
  deleteObjects,
  getObjectStream,
  getSignedDownloadUrl,
  generateKey,
};
