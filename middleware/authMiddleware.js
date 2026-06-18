const jwt = require("jsonwebtoken");
const User = require("../models/User");

const responderRoles = ["responder", "police", "fire", "medical", "drrm", "barangay"];

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (req.user.accountStatus === "inactive") {
      return res.status(403).json({ message: "Account is inactive" });
    }

    if (responderRoles.includes(req.user.role)) {
      await User.findByIdAndUpdate(req.user._id, {
        lastSeenAt: new Date(),
        isOnline: req.user.responderStatus !== "offline",
      });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied for this role",
      });
    }

    next();
  };
};
