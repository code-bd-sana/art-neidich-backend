// Example usage of NotificationServices in any controller or service
const NotificationServices = require("../services/NotificationServices");

// Send to a device
NotificationServices.sendToDevice("DEVICE_TOKEN", {
  title: "Hello",
  body: "World",
});

// Send to multiple devices
NotificationServices.sendToMany(["TOKEN1", "TOKEN2"], {
  title: "Bulk",
  body: "Message",
});

// Send to a user (if you map userId to tokens)
NotificationServices.sendToUser("USER_ID", { title: "User", body: "Specific" });

// You can extend NotificationServices for FCM, APNs, or Web Push as needed.
