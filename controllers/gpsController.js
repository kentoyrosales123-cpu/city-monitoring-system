const User = require("../models/User");
const GpsLog = require("../models/GpsLog");

const responderRoles = ["police", "fire", "medical", "drrm", "barangay", "responder"];
const onlineStatuses = ["available", "responding", "on_duty"];

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
    const responders = await User.find({
      role: { $in: responderRoles },
      status: { $in: onlineStatuses },
    })
      .select("-password")
      .populate("agency")
      .sort({ lastLocationUpdate: -1 });

    res.json(responders);
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
