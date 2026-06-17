const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["crime", "fire", "medical", "disaster", "traffic", "security", "other"],
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    barangay: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["reported", "verified", "responding", "resolved", "cancelled"],
      default: "reported",
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Incident", incidentSchema);