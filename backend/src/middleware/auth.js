const jwt = require("jsonwebtoken");

const UserModel = require("../models/UserModel");

/**
 * Express middleware to authenticate user via JWT.
 * Attaches user object to req.user if valid.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "change_this_secret";
    const decoded = jwt.verify(token, secret);
    // Optionally fetch user from DB for fresh data
    const user = await UserModel.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Middleware to check user role(s).
 * Usage: router.get('/admin', authenticate, authorizeRoles('admin'), ...)
 * @param {...string} roles
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { authenticate, authorizeRoles };
