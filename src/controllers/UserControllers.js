const {
  getProfile,
  updateProfile,
  getUsers,
  getUserById,
  approveUser,
  suspendUser,
  unSuspendUser,
  deleteUser,
} = require("../services/UserServices");

/**
 * Controller to get logged-in user's profile
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getUserProfileController(req, res, next) {
  try {
    const user = await getProfile(req.user._id);
    res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to update logged-in user's profile
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateUserProfileController(req, res, next) {
  try {
    const payload = req.validated;
    const updatedUser = await updateProfile(req.user.id, payload);
    res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all users (admin and root only)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAllUsersController(req, res, next) {
  try {
    const { users, metaData } = await getUsers(req.query);
    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      metaData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user by ID (admin and root only)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getUserByIdController(req, res, next) {
  try {
    const user = await getUserById(req.params.id);
    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve a user (admin and root only)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function approveUserController(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot approve yourself",
      });
    }
    await approveUser(req.params.id);
    res.status(200).json({
      success: true,
      message: "User approved successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Suspend a user (admin and root only)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function suspendUserController(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot suspend yourself",
      });
    }
    await suspendUser(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "User suspended successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Un-suspend a user (admin and root only)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function unSuspendUserController(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot un-suspend yourself",
      });
    }
    await unSuspendUser(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "User un-suspended successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a user (root only)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteUserController(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete yourself",
      });
    }
    await deleteUser(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUserProfileController,
  updateUserProfileController,
  getAllUsersController,
  getUserByIdController,
  approveUserController,
  suspendUserController,
  unSuspendUserController,
  deleteUserController,
};
