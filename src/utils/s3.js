/**
 * Utility functions for interacting with AWS S3.
 *
 * Provides functions to upload and delete files in S3.
 */
const {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { nanoid } = require("nanoid");

/**
 * AWS S3 Configuration
 *
 * Reads configuration from environment variables.
 * Throws an error if the required BUCKET variable is not set.
 * Initializes an S3 client for further operations.
 * Defines utility functions for uploading and deleting files in S3.
 * @module utils/s3
 */
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Ensure the S3 bucket name is provided
 *
 * @throws {Error} If AWS_S3_BUCKET environment variable is not set
 * @module utils/s3
 */
if (!BUCKET) {
  throw new Error("AWS_S3_BUCKET environment variable is required");
}

/**
 * Initialize S3 Client
 *
 * Creates an instance of S3Client using the specified region.
 * @module utils/s3
 */
const s3Client = new S3Client({ region: REGION });

/**
 * Generate a unique S3 object key
 *
 * Creates a unique key for storing files in S3 by combining the current timestamp,
 * a nanoid, and a sanitized version of the original filename.
 *
 * @param {string} filename - Original filename
 * @returns {string} Unique S3 object key
 * @module utils/s3
 */
function makeKey(filename = "file") {
  const safe = String(filename).replace(/\s+/g, "_");
  return `${Date.now()}_${nanoid()}_${safe}`;
}

/**
 * Upload a file stream to S3
 *
 * Uploads a readable stream to the specified S3 bucket.
 * @param {Object} params - Upload parameters
 * @param {stream.Readable} params.stream - Readable stream of the file to upload
 * @param {string} params.filename - Original filename
 * @param {string} [params.contentType] - MIME type of the file
 * @param {string} [params.Key] - Optional S3 object key; if not provided, a unique key will be generated
 * @returns {Promise<Object>} Upload result containing Key, Location, ETag, and full result
 * @module utils/s3
 */
async function uploadStream({ stream, filename, contentType, Key }) {
  const key = Key || makeKey(filename);

  const uploader = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType || "application/octet-stream",
    },
  });

  const result = await uploader.done();

  const location = REGION
    ? `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
    : `https://${BUCKET}.s3.amazonaws.com/${key}`;

  return {
    Key: key,
    Location: location,
    ETag: result.ETag,
    result,
  };
}

/**
 * Upload multiple file streams to S3
 *
 * Uploads multiple readable streams to the specified S3 bucket.
 * @param {Array<Object>} files - Array of upload parameters
 * @param {stream.Readable} files[].stream - Readable stream of the file to upload
 * @param {string} files[].filename - Original filename
 * @param {string} [files[].contentType] - MIME type of the file
 * @param {string} [files[].Key] - Optional S3 object key; if not provided, a unique key will be generated
 * @returns {Promise<Array<Object>>} Array of upload results
 * @module utils/s3
 */
async function uploadMultiple(files = []) {
  const uploads = files.map((f) => uploadStream(f));
  return Promise.all(uploads);
}

/**
 * Delete an object from S3
 *
 * Deletes a single object from the specified S3 bucket.
 * @param {string} Key - S3 object key to delete
 * @returns {Promise<Object>} Deletion result
 * @module utils/s3
 */
async function deleteObject(Key) {
  if (!Key) throw new Error("Key is required to delete object");
  const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key });
  return s3Client.send(cmd);
}

/**
 * Delete multiple objects from S3
 *
 * Deletes multiple objects from the specified S3 bucket.
 * @param {Array<string|Object>} Keys - Array of S3 object keys or objects with Key property to delete
 * @returns {Promise<Object>} Deletion result
 * @module utils/s3
 */
async function deleteMultiple(Keys = []) {
  if (!Array.isArray(Keys) || Keys.length === 0) {
    throw new Error(
      "Keys must be a non-empty array to delete multiple objects"
    );
  }

  const Objects = Keys.map((k) => (typeof k === "string" ? { Key: k } : k));

  const cmd = new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: {
      Objects,
      Quiet: true,
    },
  });

  return s3Client.send(cmd);
}

module.exports = {
  uploadStream,
  uploadMultiple,
  deleteObject,
  deleteMultiple,
};
