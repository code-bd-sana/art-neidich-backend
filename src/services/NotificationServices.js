// NotificationServices.js
// Centralized service for sending push notifications
// Extend this for different providers (FCM, APNs, Web Push, etc.)

class NotificationServices {
  // Example: send notification to a single device/user
  async sendToDevice(deviceToken, payload) {
    // Implement provider-specific logic here
    // e.g., call FCM, APNs, or web push
    throw new Error("sendToDevice not implemented");
  }

  // Example: send notification to multiple devices/users
  async sendToMany(deviceTokens, payload) {
    // Implement provider-specific logic here
    throw new Error("sendToMany not implemented");
  }

  // Example: send notification by userId (if you map users to tokens)
  async sendToUser(userId, payload) {
    // Implement user-token lookup and send
    throw new Error("sendToUser not implemented");
  }
}

module.exports = new NotificationServices();
