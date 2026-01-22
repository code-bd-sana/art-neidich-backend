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

const region =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-1";
const bucket = process.env.AWS_S3_BUCKET;

if (!bucket) {
  console.warn(
    "AWS_S3_BUCKET is not set. S3 operations will fail until configured.",
  );
}

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

function sanitizeKey(key) {
  if (!key) return "";
  return key.replace(/^\/+/, "").replace(/\.\.+/g, "").replace(/\\/g, "/");
}

function generateKey(originalName = "") {
  const ext = path.extname(originalName || "") || "";
  return `${uuidv4()}${ext}`;
}

// ────────────────────────────────────────────────
// SINGLE FILE FUNCTIONS
// ────────────────────────────────────────────────

async function uploadBuffer(buffer, key, contentType) {
  if (!bucket) throw new Error("S3 bucket not configured");
  const safeKey = sanitizeKey(key || generateKey());

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: safeKey,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    },
  });

  const result = await upload.done();

  return {
    Bucket: bucket,
    Key: safeKey,
    ETag: result.ETag,
    Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(safeKey)}`,
  };
}

async function uploadStream(stream, key, contentType) {
  if (!bucket) throw new Error("S3 bucket not configured");
  const safeKey = sanitizeKey(key || generateKey());

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: safeKey,
      Body: stream,
      ContentType: contentType || "application/octet-stream",
    },
  });

  const result = await upload.done();

  return {
    Bucket: bucket,
    Key: safeKey,
    ETag: result.ETag,
    Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(safeKey)}`,
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
 * Upload multiple buffers concurrently
 * @param {Array<{ buffer: Buffer, key?: string, contentType?: string, originalName?: string }>} items
 * @param {number} [concurrency=5]
 * @returns {Promise<Array<{ status: "fulfilled"|"rejected", value?: object, reason?: Error }>>}
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
          item.key || generateKey(item.originalName || ""),
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
 * Upload multiple streams concurrently
 * @param {Array<{ stream: Readable, key?: string, contentType?: string, originalName?: string }>} items
 * @param {number} [concurrency=5]
 * @returns {Promise<Array<{ status: "fulfilled"|"rejected", value?: object, reason?: Error }>>}
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
          item.key || generateKey(item.originalName || ""),
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
 * Delete multiple objects (batched, max 1000 per call)
 * @param {string[]} keys
 * @returns {Promise<{ Deleted: Array, Errors: Array }>}
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
  uploadStreams, // ← now implemented
  deleteObject,
  deleteObjects,
  getObjectStream,
  getSignedDownloadUrl,
  generateKey,
};
