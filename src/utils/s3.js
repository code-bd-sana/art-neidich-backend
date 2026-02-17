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
/**
 * Sanitize S3 object key to prevent path traversal
 * @param {string} key
 * @returns {string}
 */
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
  // Get file extension
  const ext = path.extname(originalName || "") || "";
  // Generate unique filename
  const uniquePart = `${uuidv4()}${ext}`;

  // If folderPrefix (jobId) provided, prepend it
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
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Determine final key
  const finalKey = key ? sanitizeKey(key) : generateKey("", folderPrefix);

  // Upload
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: finalKey,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    },
  });

  // Await upload completion
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
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Determine final key
  const finalKey = key ? sanitizeKey(key) : generateKey("", folderPrefix);

  // Upload
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: finalKey,
      Body: stream,
      ContentType: contentType || "application/octet-stream",
    },
  });

  // Await upload completion
  const result = await upload.done();

  return {
    Bucket: bucket,
    Key: finalKey,
    ETag: result.ETag,
    Location: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(finalKey)}`,
  };
}

/**
 * Delete a single object
 * @param {string} key
 */
async function deleteObject(key) {
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Sanitize key
  const safeKey = sanitizeKey(key);

  // Delete command
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: safeKey });

  // Execute delete
  return s3Client.send(cmd);
}

/**
 * Get object as stream
 * @param {string} key
 * @returns {Promise<import('stream').Readable>}
 */
async function getObjectStream(key) {
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Sanitize key
  const safeKey = sanitizeKey(key);

  // Get command
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: safeKey });

  // Execute get
  const res = await s3Client.send(cmd);

  return res.Body;
}

/**
 * Get signed download URL
 * @param {string} key
 * @param {number} [expiresIn=900] - Expiration time in seconds (default 15 mins)
 * @returns {Promise<string>}
 */
async function getSignedDownloadUrl(key, expiresIn = 900) {
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Sanitize key
  const safeKey = sanitizeKey(key);

  // Get command
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
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Return early if no items
  if (!Array.isArray(items) || items.length === 0) return [];

  // Process items with concurrency control
  const results = new Array(items.length);

  // Create a queue of items to process
  const queue = items.map((it, ix) => ({ item: it, ix }));

  // Worker function to process items
  async function processNext() {
    while (queue.length > 0) {
      // Get next item from the queue
      const { item, ix } = queue.shift();

      // Upload each item
      try {
        // Determine safe key
        const safeKey = sanitizeKey(
          item.key ||
            generateKey(item.originalName || "", item.folderPrefix || ""),
        );

        // Create upload
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucket,
            Key: safeKey,
            Body: item.buffer,
            ContentType: item.contentType || "application/octet-stream",
          },
        });

        // Await upload completion
        const result = await upload.done();

        // Store result
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

  // Start worker pool
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => processNext(),
  );

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Upload multiple streams – supports jobId per item
 */
async function uploadStreams(items, concurrency = 5) {
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Return early if no items
  if (!Array.isArray(items) || items.length === 0) return [];

  // Process items with concurrency control
  const results = new Array(items.length);

  // Create a queue of items to process
  const queue = items.map((it, ix) => ({ item: it, ix }));

  // Worker function to process items
  async function processNext() {
    while (queue.length > 0) {
      // Get next item from the queue
      const { item, ix } = queue.shift();
      try {
        // Determine safe key
        const safeKey = sanitizeKey(
          item.key ||
            generateKey(item.originalName || "", item.folderPrefix || ""),
        );

        // Create upload
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucket,
            Key: safeKey,
            Body: item.stream,
            ContentType: item.contentType || "application/octet-stream",
          },
        });

        // Await upload completion
        const result = await upload.done();

        // Store result
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

  // Start worker pool
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => processNext(),
  );

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Delete multiple objects (batched)
 */
async function deleteObjects(keys) {
  // Sanity check for bucket
  if (!bucket) {
    const err = new Error("S3 bucket not configured");
    err.code = 500;
    throw err;
  }

  // Return early if no keys
  if (!keys || keys.length === 0) return { Deleted: [], Errors: [] };

  // Sanitize keys and chunk into batches of 1000
  const safeKeys = keys.map(sanitizeKey).filter(Boolean);

  // Chunking
  const chunks = [];

  // AWS S3 DeleteObjects API allows max 1000 keys per request
  for (let i = 0; i < safeKeys.length; i += 1000) {
    chunks.push(safeKeys.slice(i, i + 1000));
  }

  // Aggregate results
  const finalResult = { Deleted: [], Errors: [] };

  // Process each chunk
  for (const chunk of chunks) {
    const cmd = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: chunk.map((Key) => ({ Key })),
        Quiet: false,
      },
    });

    // Execute delete
    const response = await s3Client.send(cmd);

    // Aggregate results
    if (response.Deleted) finalResult.Deleted.push(...(response.Deleted || []));

    // Aggregate errors
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
