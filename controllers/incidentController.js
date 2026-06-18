const Incident = require("../models/Incident");
const User = require("../models/User");

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedEvidenceMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const maxPhotoSize = 5 * 1024 * 1024;
const maxEvidenceSize = 10 * 1024 * 1024;

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function normalizeChoice(value, fallback) {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeIncidentSubtype(value) {
  const aliases = {
    fire: "fire_incident",
    rescue: "rescue_operation",
    traffic: "traffic_accident",
    medical: "medical_emergency",
    public_safety: "general_incident",
    fire_rescue: "fire_incident",
    disaster: "flood",
    transportation: "traffic_accident",
    other: "general_incident",
    security: "security_threat",
  };
  const normalized = normalizeChoice(value, "general_incident");
  return aliases[normalized] || normalized;
}

function typeForSubtype(subtype, requestedType) {
  const categories = {
    crime: "public_safety",
    public_disturbance: "public_safety",
    security_threat: "public_safety",
    missing_person: "public_safety",
    fire_incident: "fire_rescue",
    rescue_operation: "fire_rescue",
    medical_emergency: "medical",
    flood: "disaster",
    earthquake: "disaster",
    traffic_accident: "transportation",
    general_incident: "other",
  };
  return categories[subtype] || normalizeChoice(requestedType, "other");
}

function incidentPopulate(query) {
  return query
    .populate("reportedBy", "name role rank unit")
    .populate("assignedAgency")
    .populate("assignedResponders", "name role rank unit responderStatus isOnline")
    .populate("assignmentHistory.previousAgency assignmentHistory.nextAgency")
    .populate("assignmentHistory.previousResponders assignmentHistory.nextResponders", "name role")
    .populate("assignmentHistory.assignedBy", "name role")
    .populate("assignmentNotifications.target")
    .populate("timeline.changedBy", "name role");
}

const workflowOrder = ["reported", "verified", "assigned", "responding", "resolved", "closed"];

function canTransition(fromStatus, toStatus) {
  if (toStatus === "cancelled") return !["resolved", "closed"].includes(fromStatus);
  if (fromStatus === toStatus) return true;
  return workflowOrder.indexOf(toStatus) === workflowOrder.indexOf(fromStatus) + 1;
}

function buildIncidentFields(body) {
  const normalizedSubtype = normalizeIncidentSubtype(body.incidentSubtype || body.subtype || body.type);
  const normalizedType = typeForSubtype(normalizedSubtype, body.type);
  return {
    title: body.title,
    type: normalizedType,
    incidentSubtype: normalizedSubtype,
    description: body.description,
    address: body.address,
    barangay: body.barangay,
    latitude: body.latitude,
    longitude: body.longitude,
    severity: normalizeChoice(body.severity, "moderate"),
    photos: normalizeArray(body.photos),
    evidence: normalizeArray(body.evidence),
    assignedAgency: body.assignedAgency || null,
    assignedResponders: normalizeArray(body.assignedResponders),
  };
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    size: Math.ceil((match[2].length * 3) / 4),
  };
}

function validateAttachmentData(values, { allowedTypes, maxSize, label }) {
  const invalid = normalizeArray(values).find((value) => {
    const parsed = parseDataUrl(value);
    return !parsed || !allowedTypes.includes(parsed.mime) || parsed.size > maxSize;
  });

  if (!invalid) return "";
  return `${label} contains an unsupported file or exceeds ${Math.round(maxSize / 1024 / 1024)}MB.`;
}

function validateIncidentFields({ title, type, description, address, latitude, longitude }) {
  if (!title || !type || !description || !address || latitude === undefined || longitude === undefined) {
    return "Title, type, description, address, latitude, and longitude are required.";
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return "Latitude must be between -90 and 90.";
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return "Longitude must be between -180 and 180.";
  }

  return "";
}

exports.createIncident = async (req, res) => {
  try {
    const {
      title,
      type,
      incidentSubtype,
      subtype,
      description,
      address,
      latitude,
      longitude,
      barangay,
      severity,
      photos,
      evidence,
      assignedAgency,
      assignedResponders,
      status,
    } = req.body;
    const normalizedStatus = normalizeChoice(status, "reported");
    const normalizedSubtype = normalizeIncidentSubtype(incidentSubtype || subtype || type);
    const normalizedType = typeForSubtype(normalizedSubtype, type);

    const fieldError = validateIncidentFields({ title, type, description, address, latitude, longitude });

    if (fieldError) {
      return res.status(400).json({ message: fieldError });
    }

    const fileError = validateAttachmentData(photos, {
      allowedTypes: allowedImageMimeTypes,
      maxSize: maxPhotoSize,
      label: "Photos",
    }) || validateAttachmentData(evidence, {
      allowedTypes: allowedEvidenceMimeTypes,
      maxSize: maxEvidenceSize,
      label: "Evidence",
    });

    if (fileError) {
      return res.status(400).json({ message: fileError });
    }

    const incident = await Incident.create({
      title,
      type: normalizedType,
      incidentSubtype: normalizedSubtype,
      description,
      address,
      latitude,
      longitude,
      barangay,
      severity: normalizeChoice(severity, "moderate"),
      photos: normalizeArray(photos),
      evidence: normalizeArray(evidence),
      assignedAgency: assignedAgency || null,
      assignedResponders: normalizeArray(assignedResponders),
      status: normalizedStatus,
      reportedBy: req.user._id,
      reportedAt: new Date(),
      resolvedAt: normalizedStatus === "resolved" ? new Date() : null,
      timeline: [{
        status: normalizedStatus,
        note: "Incident reported",
        changedBy: req.user._id,
        changedAt: new Date(),
      }],
    });
    await incident.populate([
      { path: "reportedBy", select: "name role rank unit" },
      { path: "assignedAgency" },
      { path: "assignedResponders", select: "name role rank unit responderStatus isOnline" },
      { path: "timeline.changedBy", select: "name role" },
    ]);

    const io = req.app.get("io");

    io.emit("incidentCreated", {
      incident,
      message: "New incident reported",
    });

    res.status(201).json({
      message: "Incident reported successfully",
      incident,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIncidents = async (req, res) => {
  try {
    const incidents = await incidentPopulate(Incident.find())
      .sort({ reportedAt: -1, createdAt: -1 });

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIncidentById = async (req, res) => {
  try {
    const incident = await incidentPopulate(Incident.findById(req.params.id));

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    res.json(incident);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateIncidentStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const normalizedStatus = normalizeChoice(status, "");

    const allowedStatus = [
      "reported",
      "verified",
      "assigned",
      "responding",
      "resolved",
      "closed",
      "cancelled",
    ];

    if (!allowedStatus.includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid incident status" });
    }

    const currentIncident = await Incident.findById(req.params.id);

    if (!currentIncident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    if (!canTransition(currentIncident.status, normalizedStatus)) {
      return res.status(400).json({
        message: `Invalid status flow: ${currentIncident.status} cannot move to ${normalizedStatus}`,
      });
    }

    const update = {
      status: normalizedStatus,
      $push: {
        timeline: {
          status: normalizedStatus,
          note: note || `Status changed to ${normalizedStatus}`,
          changedBy: req.user._id,
          changedAt: new Date(),
        },
      },
    };

    if (normalizedStatus === "resolved") {
      update.resolvedAt = new Date();
      update.resolutionNotes = req.body.resolutionNotes || currentIncident.resolutionNotes || "";
      update.resolutionEvidence = normalizeArray(req.body.resolutionEvidence || currentIncident.resolutionEvidence);
      update.resolutionReport = req.body.resolutionReport || currentIncident.resolutionReport || "";
    } else if (normalizedStatus === "closed") {
      update.closedAt = new Date();
    } else {
      update.resolvedAt = null;
      update.closedAt = null;
    }

    const incident = await incidentPopulate(
      Incident.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    );

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    const io = req.app.get("io");

    io.emit("incidentStatusUpdated", {
      incident,
      message: "Incident status updated",
    });

    res.json({
      message: "Incident status updated successfully",
      incident,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteIncident = async (req, res) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    res.json({ message: "Incident deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateIncident = async (req, res) => {
  try {
    const existing = await Incident.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Incident not found" });
    }

    const update = buildIncidentFields(req.body);
    Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
    update.$push = {
      timeline: {
        status: existing.status,
        note: "Incident details updated",
        changedBy: req.user._id,
        changedAt: new Date(),
      },
    };

    const incident = await incidentPopulate(
      Incident.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    );

    req.app.get("io")?.emit("incidentUpdated", {
      incident,
      message: "Incident updated",
    });

    res.json({ message: "Incident updated successfully", incident });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignIncident = async (req, res) => {
  try {
    const { assignedAgency, assignedResponders } = req.body;
    const existing = await Incident.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Incident not found" });
    }

    const responderIds = normalizeArray(assignedResponders);
    const validResponders = responderIds.length
      ? await User.find({ _id: { $in: responderIds } }).select("_id name role")
      : [];

    const nextStatus = existing.status === "reported" || existing.status === "verified"
      ? "assigned"
      : existing.status;
    const previousAgency = existing.assignedAgency || null;
    const previousResponders = existing.assignedResponders || [];
    const agencyChanged = String(previousAgency || "") !== String(assignedAgency || "");
    const respondersChanged = String(previousResponders.map(String).sort()) !== String(validResponders.map((person) => String(person._id)).sort());
    const eventType = existing.assignedAgency || existing.assignedResponders?.length ? "reassigned" : "assigned";
    const assignmentEntries = [];
    const notificationEntries = [];

    if (agencyChanged && assignedAgency) {
      assignmentEntries.push({
        action: previousAgency ? "agency_reassigned" : "agency_assigned",
        previousAgency,
        nextAgency: assignedAgency,
        previousResponders,
        nextResponders: validResponders.map((person) => person._id),
        assignedBy: req.user._id,
        assignedAt: new Date(),
      });
      notificationEntries.push({
        targetType: "agency",
        target: assignedAgency,
        targetModel: "Agency",
        eventType,
        message: `Incident ${eventType} to agency`,
        notifiedAt: new Date(),
      });
    }

    if (respondersChanged && validResponders.length) {
      assignmentEntries.push({
        action: previousResponders.length ? "responder_reassigned" : validResponders.length > 1 ? "bulk_responder_assigned" : "responder_assigned",
        previousAgency,
        nextAgency: assignedAgency || null,
        previousResponders,
        nextResponders: validResponders.map((person) => person._id),
        assignedBy: req.user._id,
        assignedAt: new Date(),
      });
      validResponders.forEach((person) => {
        notificationEntries.push({
          targetType: "responder",
          target: person._id,
          targetModel: "User",
          eventType,
          message: `Incident ${eventType} to responder`,
          notifiedAt: new Date(),
        });
      });
    }

    const incident = await incidentPopulate(
      Incident.findByIdAndUpdate(
        req.params.id,
        {
          assignedAgency: assignedAgency || null,
          assignedResponders: validResponders.map((person) => person._id),
          status: nextStatus,
          $push: {
            timeline: {
              status: nextStatus,
              note: "Incident assignment updated",
              changedBy: req.user._id,
              changedAt: new Date(),
            },
            ...(assignmentEntries.length ? { assignmentHistory: { $each: assignmentEntries } } : {}),
            ...(notificationEntries.length ? { assignmentNotifications: { $each: notificationEntries } } : {}),
          },
        },
        { new: true, runValidators: true }
      )
    );

    const io = req.app.get("io");
    io?.emit("incidentAssigned", {
      incident,
      assignedAgency: incident.assignedAgency,
      assignedResponders: incident.assignedResponders,
      message: "Incident assignment updated",
    });
    if (eventType === "reassigned") {
      io?.emit("incidentReassigned", {
        incident,
        assignedAgency: incident.assignedAgency,
        assignedResponders: incident.assignedResponders,
        message: "Incident reassignment updated",
      });
    }
    io?.emit("incidentStatusUpdated", { incident, message: "Incident assignment updated" });

    res.json({ message: "Incident assignment updated successfully", incident });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
