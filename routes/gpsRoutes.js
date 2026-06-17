const express = require("express");

const {
  updateLocation,
  getLiveResponders,
  getGpsLogs,
} = require("../controllers/gpsController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/update-location", protect, updateLocation);

router.get(
  "/live-responders",
  protect,
  authorize("admin", "commander"),
  getLiveResponders
);

router.get(
  "/logs",
  protect,
  authorize("admin", "commander"),
  getGpsLogs
);

module.exports = router;