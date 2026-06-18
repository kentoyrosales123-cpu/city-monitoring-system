const User = require("../models/User");
const GpsLog = require("../models/GpsLog");

const responderRoles = ["police", "fire", "medical", "drrm", "barangay", "responder"];
const onlineStatuses = ["available", "busy", "responding"];
const onlineWindowMs = 5 * 60 * 1000;

function isRecentlyOnline(user) {
  if (!user.lastSeenAt) return false;
  return Date.now() - new Date(user.lastSeenAt).getTime() <= onlineWindowMs;
}

exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        latitude,
        longitude,
        lastLocationUpdate: new Date(),
        lastSeenAt: new Date(),
        isOnline: true,
      },
      { new: true }
    ).select("-password");

    await GpsLog.create({
      responder: req.user._id,
      latitude,
      longitude,
      accuracy: accuracy || null,
    });

    const io = req.app.get("io");

    io.emit("responderLocationUpdated", {
      responderId: user._id,
      name: user.name,
      role: user.role,
      rank: user.rank,
      unit: user.unit,
      latitude: user.latitude,
      longitude: user.longitude,
      lastLocationUpdate: user.lastLocationUpdate,
      lastSeenAt: user.lastSeenAt,
      responderStatus: user.responderStatus,
      isOnline: user.isOnline,
    });

    res.json({
      message: "Location updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLiveResponders = async (req, res) => {
  try {
    const query = {
      role: { $in: responderRoles },
    };

    if (req.query.status) query.responderStatus = req.query.status;
    if (req.query.agency) query.agency = req.query.agency;
    if (req.query.station) query.stationRef = req.query.station;
    if (req.query.barangay) query.barangayRef = req.query.barangay;

    const responders = await User.find(query)
      .select("-password")
      .populate("agency")
      .populate("stationRef")
      .populate("barangayRef")
      .sort({ lastSeenAt: -1, lastLocationUpdate: -1 });

    const rows = responders.map((responder) => {
      const record = responder.toObject();
      const recentlyOnline = isRecentlyOnline(record);
      record.isOnline = Boolean(record.isOnline && recentlyOnline && onlineStatuses.includes(record.responderStatus));
      return record;
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getGpsLogs = async (req, res) => {
  try {
    const logs = await GpsLog.find()
      .populate("responder", "name role rank unit")
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
