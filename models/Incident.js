const mongoose = require("mongoose");

const incidentTypes = [
  "public_safety",
  "crime",
  "fire",
  "fire_rescue",
  "medical",
  "disaster",
  "transportation",
  "traffic",
  "security",
  "other",
];

const incidentSubtypes = [
  "crime",
  "public_disturbance",
  "security_threat",
  "missing_person",
  "fire_incident",
  "rescue_operation",
  "medical_emergency",
  "flood",
  "earthquake",
  "traffic_accident",
  "general_incident",
];

const workflowStatuses = [
  "reported",
  "verified",
  "assigned",
  "responding",
  "resolved",
  "closed",
  "cancelled",
];

function generateIncidentNumber() {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INC-${stamp}-${suffix}`;
}

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },

    incidentNumber: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },

    title: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: incidentTypes,
      required: true,
    },

    incidentSubtype: {
      type: String,
      enum: incidentSubtypes,
      default: "general_incident",
    },

    description: {
      type: String,
      default: "",
    },

    address: {
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

    severity: {
      type: String,
      enum: ["low", "moderate", "medium", "high", "critical"],
      default: "moderate",
    },

    photos: {
      type: [String],
      default: [],
    },

    evidence: {
      type: [String],
      default: [],
    },

    assignedAgency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },

    assignedResponders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    assignmentHistory: [
      {
        action: {
          type: String,
          enum: ["agency_assigned", "agency_reassigned", "responder_assigned", "responder_reassigned", "bulk_responder_assigned"],
          required: true,
        },
        previousAgency: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Agency",
          default: null,
        },
        nextAgency: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Agency",
          default: null,
        },
        previousResponders: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        }],
        nextResponders: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        }],
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    assignmentNotifications: [
      {
        targetType: {
          type: String,
          enum: ["agency", "responder"],
          required: true,
        },
        target: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "assignmentNotifications.targetModel",
        },
        targetModel: {
          type: String,
          enum: ["Agency", "User"],
          required: true,
        },
        eventType: {
          type: String,
          enum: ["assigned", "reassigned"],
          required: true,
        },
        message: {
          type: String,
          default: "",
        },
        notifiedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    status: {
      type: String,
      enum: workflowStatuses,
      default: "reported",
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reportedAt: {
      type: Date,
      default: Date.now,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    resolutionNotes: {
      type: String,
      default: "",
    },

    resolutionEvidence: {
      type: [String],
      default: [],
    },

    resolutionReport: {
      type: String,
      default: "",
    },

    timeline: [
      {
        status: {
          type: String,
          enum: workflowStatuses,
          required: true,
        },
        note: {
          type: String,
          default: "",
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

incidentSchema.pre("validate", function setIncidentNumber(next) {
  if (!this.incidentId) {
    this.incidentId = generateIncidentNumber();
  }

  if (!this.incidentNumber) {
    this.incidentNumber = this.incidentId;
  }

  if (!this.reportedAt) {
    this.reportedAt = this.createdAt || new Date();
  }

  if (this.status === "resolved" && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }

  if (this.status === "closed" && !this.closedAt) {
    this.closedAt = new Date();
  }

  if (!this.timeline?.length) {
    this.timeline = [{
      status: this.status || "reported",
      note: "Incident reported",
      changedBy: this.reportedBy || null,
      changedAt: this.reportedAt || new Date(),
    }];
  }

  next();
});

module.exports = mongoose.model("Incident", incidentSchema);
