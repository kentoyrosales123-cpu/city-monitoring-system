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
      default: null,
    },

    rank: {
      type: String,
      default: "",
    },

    unit: {
      type: String,
      default: "",
    },

    station: {
      type: String,
      default: "",
    },

    stationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      default: null,
    },

    barangay: {
      type: String,
      default: "",
    },

    barangayRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      default: null,
    },

    photo: {
      type: String,
      default: "",
    },

    accountStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    responderStatus: {
      type: String,
      enum: ["available", "busy", "responding", "offline"],
      default: "offline",
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeenAt: {
      type: Date,
      default: null,
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
      default: null,
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
