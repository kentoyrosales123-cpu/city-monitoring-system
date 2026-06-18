const Incident = require("../models/Incident");

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
    .populate("timeline.changedBy", "name role");
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

    if (!title || !type || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Title, type, latitude, and longitude are required",
      });
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
      "cancelled",
    ];

    if (!allowedStatus.includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid incident status" });
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
    } else {
      update.resolvedAt = null;
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
