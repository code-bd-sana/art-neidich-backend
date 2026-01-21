const express = require("express");

const router = express.Router();

const { support } = require("../controllers/EmailControllers");
const { validate } = require("../utils/validator");
const { supportSchema } = require("../validators/email/support");

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
