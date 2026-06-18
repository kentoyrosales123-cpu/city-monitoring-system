const mongoose = require("mongoose");
const Station = require("../models/Station");

function normalizeObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

exports.getStations = async (req, res) => {
  try {
    const stations = await Station.find()
      .populate("agency")
      .sort({ createdAt: -1 });

    res.json(stations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createStation = async (req, res) => {
  try {
    const { name, agency, type, contactNumber, address, status } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Station name is required" });
    }

    const station = await Station.create({
      name,
      agency: normalizeObjectId(agency),
      type: type || "other",
      contactNumber,
      address,
      status,
    });

    res.status(201).json({ message: "Station created successfully", station });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStation = async (req, res) => {
  try {
    const { name, agency, type, contactNumber, address, status } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Station name is required" });
    }

    const station = await Station.findByIdAndUpdate(
      req.params.id,
      {
        name,
        agency: normalizeObjectId(agency),
        type: type || "other",
        contactNumber,
        address,
        status,
      },
      { new: true, runValidators: true }
    ).populate("agency");

    if (!station) {
      return res.status(404).json({ message: "Station not found" });
    }

    res.json({ message: "Station updated successfully", station });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStation = async (req, res) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);

    if (!station) {
      return res.status(404).json({ message: "Station not found" });
    }

    res.json({ message: "Station deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
