const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const responderRoles = ["police", "fire", "medical", "drrm", "barangay", "responder"];

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate("agency");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.accountStatus === "inactive") {
      return res.status(403).json({ message: "Account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (responderRoles.includes(user.role) && user.responderStatus !== "responding") {
      user.responderStatus = "available";
    }

    user.isOnline = true;
    user.lastSeenAt = new Date();
    await user.save();

    if (responderRoles.includes(user.role)) {
      req.app.get("io")?.emit("responderStatusUpdated", {
        responderId: user._id,
        name: user.name,
        role: user.role,
        agency: user.agency,
        status: user.responderStatus,
        responderStatus: user.responderStatus,
        isOnline: user.isOnline,
        lastSeenAt: user.lastSeenAt,
      });
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agency: user.agency,
        rank: user.rank,
        unit: user.unit,
        accountStatus: user.accountStatus,
        responderStatus: user.responderStatus,
        status: user.responderStatus,
        photo: user.photo,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    req.user.isOnline = false;
    req.user.responderStatus = "offline";
    req.user.lastSeenAt = new Date();
    await req.user.save();

    req.app.get("io")?.emit("responderStatusUpdated", {
      responderId: req.user._id,
      status: "offline",
      isOnline: false,
      lastSeenAt: req.user.lastSeenAt,
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.json({
        message: "If an account exists, a reset code has been generated.",
      });
    }

    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetHash = crypto
      .createHash("sha256")
      .update(resetCode)
      .digest("hex");

    user.passwordResetToken = resetHash;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    res.json({
      message: "Password reset code generated. It expires in 15 minutes.",
      resetCode,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, resetCode, password } = req.body;

    if (!email || !resetCode || !password) {
      return res.status(400).json({ message: "Email, reset code, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const resetHash = crypto
      .createHash("sha256")
      .update(resetCode.trim())
      .digest("hex");

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      passwordResetToken: resetHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Reset code is invalid or expired" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = "";
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.me = async (req, res) => {
  res.json(req.user);
};
