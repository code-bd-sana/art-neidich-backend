const {
  registerUser,
  loginUser,
  initiateForgotPassword,
  resetUserPassword,
  changeUserPassword,
  verifyOtp: verifyOtpService,
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
    return res.status(201).json({
      success: true,
      message:
        "User registered successfully. Your account is pending approval from an administrator. You will receive an email once your account is approved.",
      isAccountPending: true,
      code: 201,
    });
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
    const { user, token } = await loginUser(payload);

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "none", // Not same site
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
      code: 200,
    });
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
      message: payload.webRequest
        ? `Password reset link sent to the email: ${payload.email}`
        : `OTP sent to the email: ${payload.email}`,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle reset password - web password
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
    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle OTP verification - mobile password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function verifyOtp(req, res, next) {
  try {
    const payload = req.validated;
    await verifyOtpService(payload);
    return res
      .status(200)
      .json({ success: true, message: "OTP verified", code: 200 });
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
    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      code: 200,
    });
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
  verifyOtp,
};
