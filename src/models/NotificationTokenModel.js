// Small compatibility layer: controllers expect a NotificationTokenModel.
// Re-use the existing PushToken model (keeps one source of truth).
module.exports = require("./PushToken");
