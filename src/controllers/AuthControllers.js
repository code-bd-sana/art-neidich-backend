const {
  registerUser,
  loginUser,
  initiateForgotPassword,
  resetUserPassword,
  changeUserPassword,
} = require("../services/AuthServices");

/**
 * Handle user registration
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function register(req, res, next) {
  try {
    const payload = req.validated;
    await registerUser(payload);
    return res
      .status(201)
      .json({ success: true, message: "User registered successfully" });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle user login
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function login(req, res, next) {
  try {
    const payload = req.validated;
    const token = await loginUser(payload);

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "none", // Not same site
      secure: process.env.NODE_ENV === "production",
    });

    return res
      .status(200)
      .json({ success: true, message: "Login successful", token });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle forgot password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function forgotPassword(req, res, next) {
  try {
    const payload = req.validated;
    await initiateForgotPassword(payload);
    return res.status(200).json({
      success: true,
      message: "Password reset link sent if email exists",
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle reset password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function resetPassword(req, res, next) {
  try {
    const payload = req.validated;
    // Assuming resetUserPassword is a service function to handle password reset
    await resetUserPassword(payload);
    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    return next(err);
  }
}

/**
 * Change user password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function changePassword(req, res, next) {
  try {
    const payload = req.validated;
    const userId = req.user?._id;
    await changeUserPassword(userId, payload);
    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
};
