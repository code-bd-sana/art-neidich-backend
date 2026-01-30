const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const { verifyToken } = require("../helpers/jwt/jwt-utils");
const UserModel = require("../models/UserModel");

/**
 * Express middleware to authenticate user via JWT.
 *
 * Attaches user object to req.user if valid.
 *
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
    const decoded = await verifyToken(token);
    // Optionally fetch user from DB for fresh data
    const user = await UserModel.findById(
      new mongoose.Types.ObjectId(decoded.id),
    ).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found", code: 401 });
    }
    if (user.isSuspended) {
      return res
        .status(403)
        .json({ success: false, message: "You are suspended", code: 403 });
    }
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved yet",
        code: 403,
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token", code: 401 });
  }
}

/**
 * Express middleware to authorize user based on roles.
 *
 * @param  {...string} allowedRoles - Roles allowed to access the route
 * @returns {import('express').RequestHandler}
 */
function authorizeRoles(...allowedRoles) {
  const allowed = allowedRoles.map(String);
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied", code: 403 });
    }
    const userRoles = Array.isArray(req.user.role)
      ? req.user.role.map(String)
      : [String(req.user.role)];
    const hasRole = userRoles.some((r) => allowed.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: "You do not have the required role to access this resource",
        code: 403,
      });
    }
    next();
  };
}

module.exports = { authenticate, authorizeRoles };
