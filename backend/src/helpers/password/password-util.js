// Import BCRYPT library for password hashing and comparison
const bcrypt = require("bcrypt");

/**
 * Hashes the user's password using bcrypt.
 * @param {string} password - The plain text password to be hashed.
 * @returns {Promise<string>} - A promise that resolves to the hashed password.
 */
const hashPassword = async (password) => {
  // Define the number of salt rounds to use during hashing
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;

  // Use bcrypt to hash the password with the specified number of salt rounds
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compares a plain text password with a hashed password using bcrypt.
 * @param {string} plainTextPassword - The plain text password to be compared.
 * @param {string} hashedPassword - The hashed password to be compared.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the passwords match.
 */
const comparePassword = async (plainTextPassword, hashedPassword) => {
  // Use bcrypt to compare the plain text password with the hashed password
  return bcrypt.compare(plainTextPassword, hashedPassword);
};

// Export the functions for use in other parts of the application
module.exports = {
  hashPassword,
  comparePassword,
};
