const express = require("express");

const router = express.Router();

const { support } = require("../controllers/EmailControllers");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { supportSchema } = require("../validators/email/support");

// Apply authentication middleware to ALL routes in this router
router.use(authenticate);

/**
 * Handle email support request
 *
 * @route POST /api/v1/email/support
 * Public route to send an email support request
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post("/support", validate(supportSchema, { target: "body" }), support);

module.exports = router;
