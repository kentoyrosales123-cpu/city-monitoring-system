const express = require("express");
const { login, forgotPassword, resetPassword, me, logout } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", protect, logout);

router.get("/me", protect, me);

module.exports = router;
