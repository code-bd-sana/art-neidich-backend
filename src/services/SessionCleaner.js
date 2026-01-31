const PushToken = require("../models/PushToken");

/**
 * Parse duration strings like '7d', '24h', '15m', '1w' or plain numbers (days).
 * Returns milliseconds.
 */
function parseDurationToMs(str) {
  if (!str) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const s = String(str).trim().toLowerCase();

  // Support weeks 'w'
  const m = s.match(/^(\d+)\s*(d|h|m|w)?$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const num = parseInt(m[1], 10);
  const unit = m[2] || "d";
  switch (unit) {
    case "w":
      return num * 7 * 24 * 60 * 60 * 1000;
    case "d":
      return num * 24 * 60 * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "m":
      return num * 60 * 1000;
    default:
      return num * 24 * 60 * 60 * 1000; // default to days
  }
}

/**
 * Sweep expired sessions by finding PushToken docs that contain users with
 * loggedInStatus=true and loggedInLastUpdated older than expiryDate.
 * We use a cursor + bulkWrite to update only affected documents in batches
 * which is more efficient and avoids large collection-wide updates.
 */
async function sweepExpiredSessions(options = {}) {
  // Determine expiry date based on JWT expiry setting
  const jwtExpiry = process.env.JWT_EXPIRES_IN || "7d";

  // Parse expiry duration to milliseconds
  const expiryMs = parseDurationToMs(jwtExpiry);

  // Calculate expiry date - sessions older than this are considered expired
  const expiryDate = new Date(Date.now() - expiryMs);

  // Batch size for bulkWrite
  const batchSize = parseInt(
    process.env.SESSION_CLEANER_BATCH_SIZE || String(options.batchSize || 500),
    10,
  );

  // Query to find PushToken docs with users having expired sessions
  const query = {
    users: {
      $elemMatch: {
        loggedInStatus: true,
        lastLoggedInAt: { $lt: expiryDate },
      },
    },
  };

  // Use a cursor to iterate over matching documents
  const cursor = PushToken.find(query, { _id: 1 }).cursor();

  // Prepare bulk operations
  const bulkOps = [];
  let processed = 0;

  // Iterate over cursor
  try {
    for await (const doc of cursor) {
      if (!doc || !doc._id) continue;

      // Prepare update operation to set loggedInStatus=false for matching sub documents
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              "users.$[elem].loggedInStatus": false, // set loggedInStatus to false
              "users.$[elem].lastLoggedInAt": null, // clear lastLoggedInAt
              "users.$[elem].lastLoggedOutAt": new Date(), // set lastLoggedOutAt to now
              lastUsed: new Date(),
            },
          },
          arrayFilters: [
            {
              "elem.loggedInStatus": true,
              "elem.lastLoggedInAt": { $lt: expiryDate },
            },
          ],
        },
      });

      processed++;

      // Execute bulkWrite in batches
      if (bulkOps.length >= batchSize) {
        await PushToken.bulkWrite(bulkOps, { ordered: false });
        bulkOps.length = 0;
      }
    }

    // Final bulkWrite for remaining operations
    if (bulkOps.length > 0) {
      await PushToken.bulkWrite(bulkOps, { ordered: false });
      bulkOps.length = 0;
    }

    // Logging
    if (processed > 0)
      console.info(
        `sessionCleaner: marked ${processed} PushToken docs (may include multiple users) as logged-out`,
      );
    else
      console.debug(
        `sessionCleaner: no expired sessions found (expiryDate=${expiryDate.toISOString()})`,
      );
  } catch (err) {
    console.error("sessionCleaner error during sweep:", err);
  }
}

/**
 * Start the background cleaner. Use env SESSION_CLEANER_INTERVAL_MS to override (ms).
 */
function startSessionCleaner(options = {}) {
  const intervalMs = parseInt(
    process.env.SESSION_CLEANER_INTERVAL_MS ||
      String(options.intervalMs || 86400000), // default 1 day
    10,
  );

  // Run initial sweep on startup (don't await)
  sweepExpiredSessions(options).catch((e) =>
    console.error("sessionCleaner initial run error:", e),
  );

  const id = globalThis.setInterval(() => {
    // swallow errors inside interval
    sweepExpiredSessions(options).catch((e) =>
      console.error("sessionCleaner scheduled run error:", e),
    );
  }, intervalMs);

  return {
    stop() {
      globalThis.clearInterval(id);
    },
  };
}

module.exports = { startSessionCleaner, sweepExpiredSessions };
