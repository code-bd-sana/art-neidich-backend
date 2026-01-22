/**
 * Mailgun utility for sending single and bulk emails using Mailgun HTTP API.
 */

const { Buffer } = require("buffer");
const https = require("https");
const querystring = require("querystring");
const { URL } = require("url");

const dotenv = require("dotenv");

const { logError } = require("../helpers/logger");

dotenv.config();

const {
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  MAILGUN_FROM,
  MAILGUN_FROM_NAME,
  MAILGUN_BASE_URL,
} = process.env;

if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
  logError(new Error("Missing Mailgun configuration"), {
    message: "MAILGUN_API_KEY or MAILGUN_DOMAIN not set",
  });
}

/**
 * Resolve FROM address
 */
function resolveFromAddress() {
  const fromEmail = MAILGUN_FROM || `no-reply@${MAILGUN_DOMAIN || "localhost"}`;

  return MAILGUN_FROM_NAME ? `${MAILGUN_FROM_NAME} <${fromEmail}>` : fromEmail;
}

/**
 * Internal Mailgun HTTP request
 */
function mailgunRequest(path, postData) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`api:${MAILGUN_API_KEY || ""}`).toString("base64");

    // Parse BASE URL safely
    const baseUrl = MAILGUN_BASE_URL
      ? new URL(MAILGUN_BASE_URL)
      : new URL("https://api.mailgun.net");

    // Build path taking into account if baseUrl already contains /v3
    const basePath = (baseUrl.pathname || "").replace(/\/$/, "");
    const usePath =
      basePath && basePath.includes("/v3")
        ? `${basePath}/${MAILGUN_DOMAIN}${path}`
        : `/v3/${MAILGUN_DOMAIN}${path}`;

    const options = {
      protocol: baseUrl.protocol,
      hostname: baseUrl.hostname,
      method: "POST",
      path: usePath,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const status = res.statusCode || 0;

        if (status >= 200 && status < 300) {
          try {
            resolve(JSON.parse(data || "{}"));
          } catch {
            resolve({ raw: data });
          }
        } else {
          const err = new Error("Mailgun request failed");
          err.status = status;
          err.body = data;
          try {
            logError(err, { path: options.path, status, body: data });
          } catch (logErr) {
            // ignore logging failures
          }
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Send single email
 */
async function sendMail({ to, subject, text, html } = {}) {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error("Mailgun is not configured");
  }

  if (!to) throw new Error("`to` is required");
  if (!subject) throw new Error("`subject` is required");

  const toField = Array.isArray(to) ? to.join(",") : to;

  const payload = {
    from: resolveFromAddress(),
    to: toField,
    subject,
  };

  if (text) payload.text = text;
  if (html) payload.html = html;

  const postData = querystring.stringify(payload);

  try {
    return await mailgunRequest("/messages", postData);
  } catch (err) {
    try {
      logError(err, { to: toField, subject });
    } catch {
      console.error("Mailgun error:", err);
    }
    throw err;
  }
}

/**
 * Send bulk emails (batched)
 */
async function sendBulkMail(recipients = [], options = {}) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("`recipients` must be a non-empty array");
  }

  const {
    subject: defaultSubject,
    text: defaultText,
    html: defaultHtml,
    batchSize = 20,
  } = options;

  const results = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    const promises = batch.map((item) => {
      const recipient = typeof item === "string" ? { email: item } : item;

      return sendMail({
        to: recipient.email || recipient.to,
        subject: recipient.subject || defaultSubject,
        text: recipient.text || defaultText,
        html: recipient.html || defaultHtml,
      })
        .then((info) => ({
          status: "fulfilled",
          recipient: recipient.email || recipient.to,
          info,
        }))
        .catch((error) => ({
          status: "rejected",
          recipient: recipient.email || recipient.to,
          error: error?.message || error,
        }));
    });

    results.push(...(await Promise.all(promises)));
  }

  return results;
}

module.exports = {
  sendMail,
  sendBulkMail,
};
