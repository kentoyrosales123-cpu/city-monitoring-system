const Agency = require("../models/Agency");

exports.getAgencies = async (req, res) => {
  try {
    const agencies = await Agency.find().sort({ createdAt: -1 });
    res.json(agencies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAgency = async (req, res) => {
  try {
    const { name, type, contactNumber, address, status } = req.body;

    const agency = await Agency.create({
      name,
      type,
      contactNumber,
      address,
      status,
    });

    res.status(201).json({
      message: "Agency created successfully",
      agency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAgency = async (req, res) => {
  try {
    const { name, type, contactNumber, address, status } = req.body;

    const agency = await Agency.findByIdAndUpdate(
      req.params.id,
      {
        name,
        type,
        contactNumber,
        address,
        status,
      },
      { new: true }
    );

    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    res.json({
      message: "Agency updated successfully",
      agency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAgency = async (req, res) => {
  try {
    const agency = await Agency.findByIdAndDelete(req.params.id);

    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    res.json({ message: "Agency deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};