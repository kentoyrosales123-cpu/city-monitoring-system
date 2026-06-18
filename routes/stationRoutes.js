const express = require("express");
const {
  getStations,
  createStation,
  updateStation,
  deleteStation,
} = require("../controllers/stationController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("admin", "commander"), getStations);
router.post("/", protect, authorize("admin"), createStation);
router.put("/:id", protect, authorize("admin"), updateStation);
router.delete("/:id", protect, authorize("admin"), deleteStation);

module.exports = router;
