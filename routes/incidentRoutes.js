const express = require("express");

const {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  deleteIncident,
} = require("../controllers/incidentController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createIncident);

router.get(
  "/",
  protect,
  authorize("admin", "commander", "police", "fire", "medical", "drrm", "barangay"),
  getIncidents
);

router.get(
  "/:id",
  protect,
  authorize("admin", "commander", "police", "fire", "medical", "drrm", "barangay"),
  getIncidentById
);

router.put(
  "/:id/status",
  protect,
  authorize("admin", "commander"),
  updateIncidentStatus
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteIncident
);

module.exports = router;