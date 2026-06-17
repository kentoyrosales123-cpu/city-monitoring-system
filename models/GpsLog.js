const mongoose = require("mongoose");

const gpsLogSchema = new mongoose.Schema(
  {
    responder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    accuracy: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GpsLog", gpsLogSchema);