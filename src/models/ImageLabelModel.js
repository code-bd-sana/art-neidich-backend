const mongoose = require("mongoose");

const imageLabelSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true, versionKey: false }
);

const ImageLabelModel = mongoose.model("ImageLabel", imageLabelSchema);

module.exports = ImageLabelModel;
