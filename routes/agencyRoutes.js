const express = require("express");

const {
  getAgencies,
  createAgency,
  updateAgency,
  deleteAgency,
} = require("../controllers/agencyController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("admin", "commander"), getAgencies);
router.post("/", protect, authorize("admin"), createAgency);
router.put("/:id", protect, authorize("admin"), updateAgency);
router.delete("/:id", protect, authorize("admin"), deleteAgency);

module.exports = router;