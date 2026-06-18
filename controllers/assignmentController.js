const mongoose = require("mongoose");
const Agency = require("../models/Agency");
const Station = require("../models/Station");
const Barangay = require("../models/Barangay");
const User = require("../models/User");
const AssignmentHistory = require("../models/AssignmentHistory");

function normalizeObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

function snapshot(user) {
  return {
    agency: user.agency || null,
    stationRef: user.stationRef || null,
    barangayRef: user.barangayRef || null,
    station: user.station || "",
    barangay: user.barangay || "",
  };
}

async function resolveAssignment({ agency, stationRef, barangayRef }) {
  const [agencyRecord, stationRecord, barangayRecord] = await Promise.all([
    normalizeObjectId(agency) ? Agency.findById(agency) : null,
    normalizeObjectId(stationRef) ? Station.findById(stationRef) : null,
    normalizeObjectId(barangayRef) ? Barangay.findById(barangayRef) : null,
  ]);

  return {
    hasAgency: Boolean(agency),
    hasStation: Boolean(stationRef),
    hasBarangay: Boolean(barangayRef),
    agency: agencyRecord?._id || null,
    stationRef: stationRecord?._id || null,
    barangayRef: barangayRecord?._id || null,
    station: stationRecord?.name || "",
    barangay: barangayRecord?.name || "",
  };
}

exports.assignPersonnel = async (req, res) => {
  try {
    const { userIds, agency, stationRef, barangayRef } = req.body;
    const ids = Array.isArray(userIds) ? userIds : [req.body.userId].filter(Boolean);

    if (!ids.length) {
      return res.status(400).json({ message: "At least one personnel record is required" });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length) {
      return res.status(400).json({ message: "No valid personnel IDs provided" });
    }

    const nextAssignment = await resolveAssignment({ agency, stationRef, barangayRef });
    const users = await User.find({ _id: { $in: validIds } });
    const updatedUsers = [];
    const historyRows = [];

    for (const user of users) {
      const previous = snapshot(user);
      if (nextAssignment.hasAgency) {
        user.agency = nextAssignment.agency;
      }
      if (nextAssignment.hasStation) {
        user.stationRef = nextAssignment.stationRef;
        user.station = nextAssignment.station;
      }
      if (nextAssignment.hasBarangay) {
        user.barangayRef = nextAssignment.barangayRef;
        user.barangay = nextAssignment.barangay;
      }
      await user.save();

      historyRows.push({
        user: user._id,
        changedBy: req.user?._id || null,
        action: validIds.length > 1 ? "bulk_assigned" : previous.agency || previous.stationRef || previous.barangayRef ? "reassigned" : "assigned",
        previous,
        next: snapshot(user),
      });

      updatedUsers.push(user);
    }

    if (historyRows.length) {
      await AssignmentHistory.insertMany(historyRows);
    }

    res.json({
      message: `${updatedUsers.length} personnel assignment${updatedUsers.length === 1 ? "" : "s"} updated`,
      users: updatedUsers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAssignmentHistory = async (req, res) => {
  try {
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.query.user)) {
      query.user = req.query.user;
    }

    const history = await AssignmentHistory.find(query)
      .populate("user", "name role email")
      .populate("changedBy", "name role email")
      .populate("previous.agency next.agency")
      .populate("previous.stationRef next.stationRef")
      .populate("previous.barangayRef next.barangayRef")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
