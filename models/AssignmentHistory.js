const mongoose = require("mongoose");

const assignmentSnapshotSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },
    stationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      default: null,
    },
    barangayRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      default: null,
    },
    station: {
      type: String,
      default: "",
    },
    barangay: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const assignmentHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      enum: ["assigned", "reassigned", "bulk_assigned"],
      default: "assigned",
    },
    previous: assignmentSnapshotSchema,
    next: assignmentSnapshotSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssignmentHistory", assignmentHistorySchema);
