const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Station = require("../models/Station");
const Barangay = require("../models/Barangay");
const AssignmentHistory = require("../models/AssignmentHistory");

function normalizeObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

async function resolveLocationNames({ stationRef, barangayRef, station, barangay }) {
  const [stationRecord, barangayRecord] = await Promise.all([
    normalizeObjectId(stationRef) ? Station.findById(stationRef) : null,
    normalizeObjectId(barangayRef) ? Barangay.findById(barangayRef) : null,
  ]);

  return {
    stationRef: stationRecord?._id || null,
    barangayRef: barangayRecord?._id || null,
    station: stationRecord?.name || station || "",
    barangay: barangayRecord?.name || barangay || "",
  };
}

function assignmentSnapshot(user) {
  return {
    agency: user.agency || null,
    stationRef: user.stationRef || null,
    barangayRef: user.barangayRef || null,
    station: user.station || "",
    barangay: user.barangay || "",
  };
}

function assignmentChanged(previous, next) {
  return String(previous.agency || "") !== String(next.agency || "")
    || String(previous.stationRef || "") !== String(next.stationRef || "")
    || String(previous.barangayRef || "") !== String(next.barangayRef || "");
}

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("agency")
      .populate("stationRef")
      .populate("barangayRef")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      agency,
      rank,
      unit,
      accountStatus,
      responderStatus,
      station,
      stationRef,
      barangay,
      barangayRef,
      photo,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const location = await resolveLocationNames({ stationRef, barangayRef, station, barangay });

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      agency: normalizeObjectId(agency),
      rank,
      unit,
      accountStatus: accountStatus || "active",
      responderStatus: responderStatus || "offline",
      station: location.station,
      stationRef: location.stationRef,
      barangay: location.barangay,
      barangayRef: location.barangayRef,
      photo: photo || "",
    });

    const initialAssignment = assignmentSnapshot(user);
    if (initialAssignment.agency || initialAssignment.stationRef || initialAssignment.barangayRef) {
      await AssignmentHistory.create({
        user: user._id,
        changedBy: req.user?._id || null,
        action: "assigned",
        previous: {},
        next: initialAssignment,
      });
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agency: user.agency,
        rank: user.rank,
        unit: user.unit,
        station: user.station,
        stationRef: user.stationRef,
        barangay: user.barangay,
        barangayRef: user.barangayRef,
        photo: user.photo,
        accountStatus: user.accountStatus,
        responderStatus: user.responderStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      agency,
      rank,
      unit,
      accountStatus,
      responderStatus,
      station,
      stationRef,
      barangay,
      barangayRef,
      photo,
    } = req.body;

    const existingUser = await User.findOne({
      email,
      _id: { $ne: req.params.id },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already used by another personnel",
      });
    }

    const location = await resolveLocationNames({ stationRef, barangayRef, station, barangay });

    const previousUser = await User.findById(req.params.id);

    if (!previousUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const previousAssignment = assignmentSnapshot(previousUser);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        role,
        agency: normalizeObjectId(agency),
        rank,
        unit,
        accountStatus,
        responderStatus,
        station: location.station,
        stationRef: location.stationRef,
        barangay: location.barangay,
        barangayRef: location.barangayRef,
        photo: photo || "",
      },
      { new: true, runValidators: true }
    )
      .select("-password")
      .populate("agency")
      .populate("stationRef")
      .populate("barangayRef");

    const nextAssignment = assignmentSnapshot(user);
    if (assignmentChanged(previousAssignment, nextAssignment)) {
      await AssignmentHistory.create({
        user: user._id,
        changedBy: req.user?._id || null,
        action: previousAssignment.agency || previousAssignment.stationRef || previousAssignment.barangayRef ? "reassigned" : "assigned",
        previous: previousAssignment,
        next: nextAssignment,
      });
    }

    res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMyStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ["available", "busy", "responding", "offline"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid responder status" });
    }

    const isOnline = status !== "offline";

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        responderStatus: status,
        isOnline,
        lastSeenAt: new Date(),
      },
      { new: true, runValidators: true }
    )
      .select("-password")
      .populate("agency")
      .populate("stationRef")
      .populate("barangayRef");

    req.app.get("io")?.emit("responderStatusUpdated", {
      responderId: user._id,
      name: user.name,
      role: user.role,
      agency: user.agency,
      station: user.stationRef || user.station,
      barangay: user.barangayRef || user.barangay,
      status: user.responderStatus,
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt,
    });

    res.json({
      message: "Status updated successfully",
      user,
    });

    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
