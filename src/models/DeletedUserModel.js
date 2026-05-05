const mongoose = require("mongoose");

const deletedUserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  deletedAt: {
    type: Date,
    default: Date.now,
  },
  deletedBy: {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: { type: Number, required: true },
    email: {type: String},
    name: {type: String}
  },
});

// Optional: Add a TTL (Time To Live) index to auto-delete records after 90 days
// deletedUserSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const DeletedUserModel = mongoose.model("DeletedUser", deletedUserSchema);

module.exports = DeletedUserModel;
