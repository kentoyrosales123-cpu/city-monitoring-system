const express = require("express");
const {
  assignPersonnel,
  getAssignmentHistory,
} = require("../controllers/assignmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/history", protect, authorize("admin", "commander"), getAssignmentHistory);
router.post("/personnel", protect, authorize("admin"), assignPersonnel);

module.exports = router;
