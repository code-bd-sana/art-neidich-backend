const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const { customAlphabet } = require("nanoid");

const nanoidLower = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

/**
 * User schema for authentication and authorization
 * @typedef {Object} User
 * @property {string} userId - Unique short user ID
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {string} password
 * @property {string} role - User role (root, admin, instructor)
 */
const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      required: true,
      default: () => nanoidLower(),
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allows null or unique values
      trim: true,
      lowercase: true,
      validate: [
        {
          validator: function (v) {
            // Perform validation only when email is provided
            if (this.email) {
              // Regular expression for email validation
              return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            }
            // Skip validation when email is not provided
            return true;
          },
          message: (props) => `${props.value} is not a valid email address!`,
        },
      ],
    },
    isSuspended: {
      type: Boolean,
      default: false, // User account is active by default
    },
    isApproved: {
      type: Boolean,
      default: false, // Only root and admin can approve users
    },
    password: {
      type: String,
      required: true,
      minLength: 6,
    },
    role: {
      type: Number,
      enum: [0, 1, 2], // 0 = root, 1 = admin, 2 = inspector
    },
    resetToken: {
      type: String,
      default: null,
    },
    resetTokenExpiry: {
      type: Date,
      default: null,
    },
    resetPasswordOTP: {
      type: String,
      default: null,
    },
    resetPasswordOTPExpiry: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

// Instance method to hide sensitive fields
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;

userSchema.index({
  firstName: "text",
  lastName: "text",
  email: "text",
  userId: "text",
});
