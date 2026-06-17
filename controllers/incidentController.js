const Incident = require("../models/Incident");

exports.createIncident = async (req, res) => {
  try {
    const {
      title,
      type,
      description,
      latitude,
      longitude,
      barangay,
      status,
    } = req.body;

    if (!title || !type || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Title, type, latitude, and longitude are required",
      });
    }

    const incident = await Incident.create({
      title,
      type,
      description,
      latitude,
      longitude,
      barangay,
      status: status || "reported",
      reportedBy: req.user._id,
    });

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
    const incidents = await Incident.find()
      .populate("reportedBy", "name role rank unit")
      .sort({ createdAt: -1 });

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id).populate(
      "reportedBy",
      "name role rank unit"
    );

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
    const { status } = req.body;

    const allowedStatus = [
      "reported",
      "verified",
      "responding",
      "resolved",
      "cancelled",
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid incident status" });
    }

    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("reportedBy", "name role rank unit");

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