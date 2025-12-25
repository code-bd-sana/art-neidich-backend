const { generateToken } = require("../helpers/jwt/jwt-utils");
const {
  hashPassword,
  comparePassword,
} = require("../helpers/password/password-util");
const UserModel = require("../models/UserModel");

/**
 * Register a new user
 * @param {{firstName: string, lastName: string, email: string, password: string}} payload
 * @returns {Promise<void>}
 */
async function registerUser(payload) {
  const { firstName, lastName, email, password } = payload;

  const existing = await UserModel.findOne({ email });
  if (existing) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  const hashed = await hashPassword(password);

  await UserModel.create({
    firstName: firstName,
    lastName: lastName,
    email,
    password: hashed,
  });

  return;
}

/**
 * Authenticate user and return token
 * @param {{email: string, password: string}} payload
 * @returns {Promise<{token: string}>}
 */
async function loginUser(payload) {
  const { email, password } = payload;
  const user = await UserModel.findOne({ email });
  if (!user) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const match = await comparePassword(password, user.password);
  if (!match) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const token = generateToken({
    id: user._id,
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  });

  return token;
}

module.exports = { registerUser, loginUser };
