const jwt = require("jsonwebtoken");

/**
 * Generates a JWT token for the given user ID.
 * @param {string} userId - The user ID to be included in the token.
 * @returns {Promise<string>} - A promise that resolves to the generated JWT token.
 */
const generateToken = async (userData) => {
  try {
    const secretKey = process.env.JWT_SECRET_KEY;
    const token = await jwt.sign(userData, secretKey);
    return token;
  } catch (error) {
    // Handle any errors during token generation
    console.error(error);
    throw new Error("Token generation failed.");
  }
};

/**
 * Verifies a JWT token and returns the user ID.
 * @param {string} token - The JWT token to be verified.
 * @returns {Promise<string|null>} - A promise that resolves to the user ID if verification is successful, otherwise null.
 */
const verifyToken = async (token) => {
  try {
    const secretKey = process.env.JWT_SECRET_KEY;
    const decoded = await jwt.verify(token, secretKey);
    return decoded._id;
  } catch (error) {
    // Handle any errors during token verification
    console.error(error);
    return null;
  }
};

module.exports = { generateToken, verifyToken };
