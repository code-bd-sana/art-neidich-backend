const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

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
      default: () => nanoid(10),
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
    password: {
      type: String,
      required: true,
      minLength: 6,
      select: false, // Hide password by default
    },
    role: {
      type: String,
      enum: ["root", "admin", "instructor"],
      default: "instructor",
    },
  },
  { timestamps: true, versionKey: false }
);

// Pre-save hook to ensure userId is set
userSchema.pre("save", function (next) {
  if (!this.userId) {
    this.userId = nanoid(10);
  }
  next();
});

// Instance method to hide sensitive fields
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;
