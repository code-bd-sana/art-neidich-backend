const mongoose = require("mongoose");

const imageLabelSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const ImageLabelModel = mongoose.model("ImageLabel", imageLabelSchema);

module.exports = ImageLabelModel;
