const mongoose = require("mongoose");

const ImageLabelModel = require("../models/ImageLabelModel");
const ReportModel = require("../models/ReportModel");

// Utility function to escape special regex characters in a string (e.g., for search)
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a new image label if it doesn't already exist (case-insensitive)
 *
 * @param {{label: string}} payload
 * @returns {Promise<Object>} created label
 */
async function createImageLabel(payload, user) {
  const label = payload.label;

  const escaped = escapeRegExp(label);
  const existing = await ImageLabelModel.findOne({
    label: { $regex: `^${escaped}$`, $options: "i" },
  });

  if (existing) {
    const err = new Error("Label already exists");
    err.status = 400;
    err.code = "LABEL_EXISTS";
    throw err;
  }

  // Create new label
  const created = await ImageLabelModel.create(payload);

  // Optionally, return with creator info via aggregation
  const result = await ImageLabelModel.aggregate([
    // Match the created label
    { $match: { _id: created._id } },
    // Lookup createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    // Lookup lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },

    { $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true } },
    // Map roles
    {
      $addFields: {
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
    // Project safe fields
    {
      $project: {
        label: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: {
          _id: "$createdBy._id",
          firstName: "$createdBy.firstName",
          lastName: "$createdBy.lastName",
          email: "$createdBy.email",
          role: "$createdBy.role",
        },
        lastUpdatedBy: {
          _id: "$lastUpdatedBy._id",
          firstName: "$lastUpdatedBy.firstName",
          lastName: "$lastUpdatedBy.lastName",
          email: "$lastUpdatedBy.email",
          role: "$lastUpdatedBy.role",
        },
      },
    },
  ]);

  return result[0];
}

/**
 * Get image labels with optional search and pagination
 *
 * @param {Object} query
 * @param {number} [query.page=1]
 * @param {number} [query.limit=10]
 * @param {string} [query.search]
 * @returns {Promise<{
 *   labels: Array<Object>,
 *   metaData: {
 *     page: number,
 *     limit: number,
 *     totalLabel: number,
 *     totalPage: number
 *   }
 * }>}
 */
async function getImageLabels(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const matchStage = {};
  if (search) {
    const esc = escapeRegExp(search);
    matchStage.label = { $regex: esc, $options: "i" };
  }

  const pipeline = [
    { $match: matchStage },

    // Lookup createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },

    // Lookup lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    { $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true } },

    // Map roles
    {
      $addFields: {
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },

    // Project safe fields
    {
      $project: {
        label: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: {
          _id: "$createdBy._id",
          firstName: "$createdBy.firstName",
          lastName: "$createdBy.lastName",
          email: "$createdBy.email",
          role: "$createdBy.role",
        },
        lastUpdatedBy: {
          _id: "$lastUpdatedBy._id",
          firstName: "$lastUpdatedBy.firstName",
          lastName: "$lastUpdatedBy.lastName",
          email: "$lastUpdatedBy.email",
          role: "$lastUpdatedBy.role",
        },
      },
    },

    // Sort
    { $sort: { createdAt: -1 } },

    // Facet for pagination
    {
      $facet: {
        labels: [{ $skip: skip }, { $limit: limit }],
        metaData: [{ $count: "totalLabel" }],
      },
    },
  ];

  const result = await ImageLabelModel.aggregate(pipeline);
  const labels = result[0]?.labels || [];
  const totalLabel = result[0]?.metaData[0]?.totalLabel || 0;

  return {
    labels,
    metaData: {
      page,
      limit,
      totalLabel,
      totalPage: Math.ceil(totalLabel / limit),
    },
  };
}

/**
 * Get a single image label by id
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
async function getImageLabel(id) {
  const label = await ImageLabelModel.aggregate([
    // Search by id
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    // Lookup createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    // Lookup lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    { $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true } },
    // Map roles
    {
      $addFields: {
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
    // Project safe fields
    {
      $project: {
        label: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: {
          _id: "$createdBy._id",
          firstName: "$createdBy.firstName",
          lastName: "$createdBy.lastName",
          email: "$createdBy.email",
          role: "$createdBy.role",
        },
        lastUpdatedBy: {
          _id: "$lastUpdatedBy._id",
          firstName: "$lastUpdatedBy.firstName",
          lastName: "$lastUpdatedBy.lastName",
          email: "$lastUpdatedBy.email",
          role: "$lastUpdatedBy.role",
        },
      },
    },
  ]);
  if (!label || !label.length) {
    const err = new Error("Image label not found");
    err.status = 404;
    err.code = "LABEL_NOT_FOUND";
    throw err;
  }
  return label[0];
}

/**
 * Update an image label. Checks for duplicate label value.
 *
 * @param {string} id
 * @param {{label?: string}} payload
 * @returns {Promise<Object>} updated label
 */
async function updateImageLabel(id, payload) {
  const labelValue = payload.label;

  if (labelValue) {
    const esc = escapeRegExp(labelValue);
    const existing = await ImageLabelModel.findOne({
      label: { $regex: `^${esc}$`, $options: "i" },
      _id: { $ne: id },
    });

    if (existing) {
      const err = new Error("Label already exists");
      err.status = 400;
      err.code = "LABEL_EXISTS";
      throw err;
    }
  }

  const updated = await ImageLabelModel.aggregate([
    // Update stage
    {
      $match: { _id: new mongoose.Types.ObjectId(id) },
    },
    {
      $set: {
        ...payload,
      },
    },
    // Lookup createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    // Lookup lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    { $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true } },
    // Map roles
    {
      $addFields: {
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
    // Project safe fields
    {
      $project: {
        label: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: {
          _id: "$createdBy._id",
          firstName: "$createdBy.firstName",
          lastName: "$createdBy.lastName",
          email: "$createdBy.email",
          role: "$createdBy.role",
        },
        lastUpdatedBy: {
          _id: "$lastUpdatedBy._id",
          firstName: "$lastUpdatedBy.firstName",
          lastName: "$lastUpdatedBy.lastName",
          email: "$lastUpdatedBy.email",
          role: "$lastUpdatedBy.role",
        },
      },
    },
  ]);

  if (!updated || !updated.length) {
    const err = new Error("Image label not found");
    err.status = 404;
    err.code = "LABEL_NOT_FOUND";
    throw err;
  }

  return updated[0];
}

/**
 * Delete image label
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteImageLabel(id) {
  const existing = await ImageLabelModel.findById(id);
  if (!existing) {
    const err = new Error("Image label not found");
    err.status = 404;
    err.code = "LABEL_NOT_FOUND";
    throw err;
  }
  await ImageLabelModel.findByIdAndDelete(id);
  return;
}

module.exports = {
  createImageLabel,
  getImageLabels,
  getImageLabel,
  updateImageLabel,
  deleteImageLabel,
};
