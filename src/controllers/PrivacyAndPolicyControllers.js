const {
  createPrivacyAndPolicy,
  getActivePrivacyAndPolicy,
  getPrivacyAndPolicyById,
  updatePrivacyAndPolicy,
  deletePrivacyAndPolicy,
  getAllPrivacyAndPolicy,
} = require("../services/PrivacyAndPolicyServices");

/**
 * Handle create privacy and policy
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createPrivacyAndPolicyController(req, res, next) {
  try {
    const payload = req.validated;
    const result = await createPrivacyAndPolicy(payload);
    return res.status(200).json({
      success: true,
      message: "Privacy and policy created successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get active privacy and policy
 */
async function getActivePrivacyAndPolicyController(req, res, next) {
  try {
    const result = await getActivePrivacyAndPolicy();
    return res.status(200).json({
      success: true,
      message: "Active privacy and policy retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get all privacy and policy
 */
async function getAllPrivacyAndPolicyController(req, res, next) {
  try {
    const result = await getAllPrivacyAndPolicy(req.query);
    return res.status(200).json({
      success: true,
      message: "Privacy and policy list retrieved successfully",
      code: 200,
      ...result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get privacy and policy by ID
 */
async function getPrivacyAndPolicyByIdController(req, res, next) {
  try {
    const result = await getPrivacyAndPolicyById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Privacy and policy retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle update privacy and policy
 */
async function updatePrivacyAndPolicyController(req, res, next) {
  try {
    const result = await updatePrivacyAndPolicy(req.params.id, req.validated);
    return res.status(200).json({
      success: true,
      message: "Privacy and policy updated successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle delete privacy and policy
 */
async function deletePrivacyAndPolicyController(req, res, next) {
  try {
    const result = await deletePrivacyAndPolicy(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Privacy and policy deleted successfully",
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPrivacyAndPolicyController,
  getActivePrivacyAndPolicyController,
  getAllPrivacyAndPolicyController,
  getPrivacyAndPolicyByIdController,
  updatePrivacyAndPolicyController,
  deletePrivacyAndPolicyController,
};
