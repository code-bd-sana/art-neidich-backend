/**
 * @fileoverview Nodemailer utility for sending single and bulk emails
 * with connection pooling and batching support.
 */

const nodemailer = require("nodemailer");

/**
 * Environment configuration
 */
const {
  SMTP_HOST = "smtp.example.com",
  SMTP_PORT = "587",
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
  FROM_NAME,
} = process.env;

/**
 * Nodemailer transport options
 * Uses connection pooling for better performance
 * @type {import('nodemailer').TransportOptions}
 */
const transportOptions = {
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER
    ? {
        user: SMTP_USER,
        pass: SMTP_PASS,
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

/**
 * Resolves the "from" address
 * @returns {string}
 */
function resolveFromAddress() {
  if (FROM_EMAIL) {
    return `${FROM_NAME || ""} <${FROM_EMAIL}>`;
  }
  return SMTP_USER || "";
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

  return transporter.sendMail(mailOptions);
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
