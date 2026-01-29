/**
 * @fileoverview Nodemailer utility for sending single and bulk emails
 * with connection pooling and batching support.
 */

const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

const { logError } = require("../helpers/logger");

dotenv.config();
/**
 * Environment configuration
 */
const {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM_NAME,
  MAIL_FROM,
} = process.env;

/**
 * Nodemailer transport options
 * Uses connection pooling for better performance
 * @type {import('nodemailer').TransportOptions}
 */
const transportOptions = {
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: Number(MAIL_PORT) === 465,
  auth: MAIL_USER
    ? {
        user: MAIL_USER,
        pass: MAIL_PASS,
      }
    : undefined,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
};

/**
 * Singleton transporter instance
 */
const transporter = nodemailer.createTransport(transportOptions);

// Verify transporter connection on startup and log if it fails
transporter.verify().catch((err) => {
  logError(err, { message: "Mail transporter verification failed" });
});

/**
 * Resolves the "from" address
 * @returns {string}
 */
function resolveFromAddress() {
  // Prefer explicit MAIL_FROM, fall back to MAIL_USER
  const fromEmail = MAIL_FROM || MAIL_USER || "no-reply@localhost";
  if (MAIL_FROM_NAME) {
    return `${MAIL_FROM_NAME} <${fromEmail}>`;
  }
  return fromEmail;
}

/**
 * Send a single email
 *
 * @param {Object} params
 * @param {string|string[]} params.to - Recipient email(s)
 * @param {string} [params.subject] - Email subject
 * @param {string} [params.text] - Plain text body
 * @param {string} [params.html] - HTML body
 * @param {Array<Object>} [params.attachments] - Nodemailer attachments
 *
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
async function sendMail({ to, subject, text, html, attachments } = {}) {
  if (!to) {
    throw new Error("`to` is required");
  }

  const mailOptions = {
    from: resolveFromAddress(),
    to,
    subject,
    text,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    // Log detailed error for troubleshooting
    try {
      console.log(err);
      logError(err, { mailOptions });
    } catch (e) {
      // swallow logging errors
      console.error("Error logging mail send failure:", e);
    }
    throw err;
  }
}

/**
 * Send bulk emails in controlled batches
 *
 * @param {Array<string|Object>} recipients
 * Each item can be:
 * - string email
 * - object { email, subject, text, html, attachments }
 *
 * @param {Object} [options]
 * @param {string} [options.subject] - Default subject
 * @param {string} [options.text] - Default text body
 * @param {string} [options.html] - Default HTML body
 * @param {Array<Object>} [options.attachments] - Default attachments
 * @param {number} [options.batchSize=20] - Emails per batch
 *
 * @returns {Promise<Array<Object>>}
 */
async function sendBulkMail(recipients = [], options = {}) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("`recipients` must be a non-empty array");
  }

  const {
    subject: defaultSubject,
    text: defaultText,
    html: defaultHtml,
    attachments: defaultAttachments,
    batchSize = 20,
  } = options;

  /** @type {Array<Object>} */
  const results = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    const promises = batch.map((item) => {
      const recipient = typeof item === "string" ? { email: item } : item;

      const payload = {
        to: recipient.email || recipient.to,
        subject: recipient.subject || defaultSubject,
        text: recipient.text || defaultText,
        html: recipient.html || defaultHtml,
        attachments: recipient.attachments || defaultAttachments,
      };

      return sendMail(payload)
        .then((info) => ({
          status: "fulfilled",
          recipient: payload.to,
          info,
        }))
        .catch((error) => ({
          status: "rejected",
          recipient: payload.to,
          error: error?.message || error,
        }));
    });

    const settled = await Promise.all(promises);
    results.push(...settled);
  }

  return results;
}

module.exports = {
  transporter,
  sendMail,
  sendBulkMail,
};
