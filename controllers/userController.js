const bcrypt = require("bcryptjs");
const User = require("../models/User");

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("agency")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, agency, rank, unit, status } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      agency: agency || null,
      rank,
      unit,
      status,
    });

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
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, agency, rank, unit, status } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        role,
        agency: agency || null,
        rank,
        unit,
        status,
      },
      { new: true }
    )
      .select("-password")
      .populate("agency");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

    const allowedStatuses = ["available", "responding", "offline"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid responder status" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { status },
      { new: true }
    ).select("-password");

    req.app.get("io")?.emit("responderStatusUpdated", {
      responderId: user._id,
      name: user.name,
      role: user.role,
      status: user.status,
      unit: user.unit,
    });

    res.json({
      message: "Status updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
