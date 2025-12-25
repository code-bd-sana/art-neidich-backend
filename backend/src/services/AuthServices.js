const { generateToken } = require("../helpers/jwt/jwt-utils");
const {
  hashPassword,
  comparePassword,
} = require("../helpers/password/password-util");
const UserModel = require("../models/UserModel");

/**
 * Register a new user
 *
 * @param {{firstName: string, lastName: string, email: string, password: string, role: number}} payload
 * @returns {Promise<void>}
 */
async function registerUser(payload) {
  const { firstName, lastName, email, password, role } = payload;

  const existing = await UserModel.findOne({ email });

  if (existing) {
    const err = new Error("Email already in use");
    err.status = 400;
    err.code = "EMAIL_IN_USE";
    throw err;
  }

  const hashed = await hashPassword(password);

  await UserModel.create({
    firstName: firstName,
    lastName: lastName,
    email,
    password: hashed,
    role,
  });

  return;
}

/**
 * Authenticate user and return token
 *
 * @param {{email: string, password: string}} payload
 * @returns {Promise<{token: string, user: object}>}
 */
async function loginUser(payload) {
  const { email, password } = payload;
  const user = await UserModel.findOne({ email });

  if (!user) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // Guard against missing values before calling bcrypt.compare
  if (!password || typeof password !== "string" || !password.length) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  if (
    !user.password ||
    typeof user.password !== "string" ||
    !user.password.length
  ) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  const match = await comparePassword(password, user.password);

  if (!match) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
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

  return { token, user };
}

module.exports = { registerUser, loginUser };
