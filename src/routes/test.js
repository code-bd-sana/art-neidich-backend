const fs = require("fs");

const express = require("express");
const multer = require("multer");

const router = express.Router();
const {
  uploadBuffer,
  uploadBuffers,
  uploadStream,
  uploadStreams,
  deleteObjects,
} = require("../utils/s3");

// Multer setup (in-memory) for test upload routes
const storage = multer.memoryStorage();
const upload = multer({ storage });
/**
 * Test route to upload single file
 *
 * @route POST /api/v1/test/single-upload
 * Public route to test file upload functionality
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/single-upload",
  upload.single("image"),
  async (req, res, next) => {
    try {
      // prefer explicit field name 'image' for single upload
      function getFilesFromReq(req) {
        console.log(req);
        // If multer.single('image') used -> req.file
        if (req.file) return [req.file];

        // If multer.fields or array used and field is named 'image'
        if (req.files) {
          if (req.files.image) {
            return Array.isArray(req.files.image)
              ? req.files.image
              : [req.files.image];
          }
          // sometimes clients send single file under 'images' accidentally
          if (req.files.images) {
            return Array.isArray(req.files.images)
              ? [req.files.images[0]]
              : [req.files.images];
          }

          // last resort: any files present
          if (Array.isArray(req.files)) return req.files;
          return Object.values(req.files).flat();
        }

        return [];
      }

      const files = getFilesFromReq(req);
      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({ message: "No file provided. Use form field name 'image'" });
      }

      const file = files[0];

      let uploadResult;

      if (file.buffer) {
        // in-memory buffer (multer memoryStorage)
        uploadResult = await uploadBuffer(
          file.buffer,
          null,
          file.mimetype,
          file.folderPrefix || "",
        );
      } else if (file.path) {
        // disk storage - stream from path
        const stream = fs.createReadStream(file.path);
        uploadResult = await uploadStream(
          stream,
          null,
          file.mimetype,
          file.folderPrefix || "",
        );
      } else {
        return res.status(400).json({ message: "Unsupported file object" });
      }

      return res
        .status(200)
        .json({ message: "File uploaded successfully", file: uploadResult });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * Test route to upload multiple files
 *
 * @route POST /api/v1/test/multiple-upload
 * Public route to test multiple file upload functionality
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/multiple-upload",
  upload.array("images"),
  async (req, res, next) => {
    try {
      // prefer explicit field name 'images' for multiple upload
      function getFilesFromReq(req) {
        // If multer.array('images') used -> req.files is an array
        if (req.files) {
          if (req.files.images)
            return Array.isArray(req.files.images)
              ? req.files.images
              : [req.files.images];
          if (req.files.image)
            return Array.isArray(req.files.image)
              ? req.files.image
              : [req.files.image];
          if (Array.isArray(req.files)) return req.files;
          return Object.values(req.files).flat();
        }

        // multer.single('image') -> single file only
        if (req.file) return [req.file];

        return [];
      }

      const files = getFilesFromReq(req);
      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({ message: "No files provided. Use form field name 'images'" });
      }

      const bufferItems = [];
      const streamItems = [];

      for (const f of files) {
        const folderPrefix = f.folderPrefix || "";
        if (f.buffer) {
          bufferItems.push({
            buffer: f.buffer,
            contentType: f.mimetype,
            originalName: f.originalname,
            folderPrefix,
          });
        } else if (f.path) {
          streamItems.push({
            stream: fs.createReadStream(f.path),
            contentType: f.mimetype,
            originalName: f.originalname,
            folderPrefix,
          });
        }
      }

      const results = [];

      if (bufferItems.length > 0) {
        const r = await uploadBuffers(bufferItems);
        results.push(...r);
      }

      if (streamItems.length > 0) {
        const r2 = await uploadStreams(streamItems);
        results.push(...r2);
      }

      return res
        .status(200)
        .json({ message: "Files uploaded successfully", results });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
