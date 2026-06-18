const Barangay = require("../models/Barangay");

exports.getBarangays = async (req, res) => {
  try {
    const barangays = await Barangay.find().sort({ name: 1 });
    res.json(barangays);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createBarangay = async (req, res) => {
  try {
    const { name, district, contactNumber, address, status } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Barangay name is required" });
    }

    const barangay = await Barangay.create({
      name,
      district,
      contactNumber,
      address,
      status,
    });

    res.status(201).json({ message: "Barangay created successfully", barangay });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBarangay = async (req, res) => {
  try {
    const { name, district, contactNumber, address, status } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Barangay name is required" });
    }

    const barangay = await Barangay.findByIdAndUpdate(
      req.params.id,
      {
        name,
        district,
        contactNumber,
        address,
        status,
      },
      { new: true, runValidators: true }
    );

    if (!barangay) {
      return res.status(404).json({ message: "Barangay not found" });
    }

    res.json({ message: "Barangay updated successfully", barangay });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteBarangay = async (req, res) => {
  try {
    const barangay = await Barangay.findByIdAndDelete(req.params.id);

    if (!barangay) {
      return res.status(404).json({ message: "Barangay not found" });
    }

    res.json({ message: "Barangay deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
