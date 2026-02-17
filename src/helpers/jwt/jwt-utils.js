const jwt = require("jsonwebtoken");

/**
 * Generates a JWT token for the given user ID.
 * @param {string} userId - The user ID to be included in the token.
 * @returns {Promise<string>} - A promise that resolves to the generated JWT token.
 */
const generateToken = async (userData) => {
  try {
    // Get secret key from environment variables
    const secretKey = process.env.JWT_SECRET_KEY;

    // Generate token
    const token = await jwt.sign(userData, secretKey, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    return token;
  } catch (error) {
    // Handle any errors during token generation
    console.error(error);

    const err = new Error("Token generation failed.");
    err.code = 500;
    throw err;
  }
};

/**
 * Verifies a JWT token and returns the user ID.
 * @param {string} token - The JWT token to be verified.
 * @returns {Promise<*>} - A promise that resolves to the decoded token payload.
 */
const verifyToken = async (token) => {
  try {
    // Get secret key from environment variables
    const secretKey = process.env.JWT_SECRET_KEY;

    // Verify token
    const decoded = await jwt.verify(token, secretKey);

    return decoded;
  } catch (error) {
    // Handle any errors during token verification
    console.error(error);
    return null;
  }
};

module.exports = { generateToken, verifyToken };
