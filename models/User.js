const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "admin",
        "commander",
        "police",
        "fire",
        "medical",
        "drrm",
        "barangay",
        "responder",
      ],
      default: "responder",
    },

    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
    },

    rank: {
      type: String,
      default: "",
    },

    unit: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "on_duty", "off_duty", "available",
"responding",
"offline"],
      default: "active",
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    lastLocationUpdate: {
      type: Date,
    },

    passwordResetToken: {
      type: String,
      default: "",
    },

    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
