const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["police", "fire", "medical", "drrm", "barangay", "command_center"],
      required: true,
    },

    contactNumber: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Agency", agencySchema);