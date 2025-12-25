const { registerUser, loginUser } = require("../services/AuthService");

/**
 * Handle user registration
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function register(req, res, next) {
  try {
    const payload = req.validated;
    await registerUser(payload, res);
    return res
      .status(201)
      .json({ success: true, message: "User registered successfully" });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle user login
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function login(req, res, next) {
  try {
    const payload = req.validated;
    const token = await loginUser(payload, res);
    return res
      .status(200)
      .json({ success: true, message: "Login successful", token });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login };
