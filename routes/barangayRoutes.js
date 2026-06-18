const express = require("express");
const {
  getBarangays,
  createBarangay,
  updateBarangay,
  deleteBarangay,
} = require("../controllers/barangayController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("admin", "commander"), getBarangays);
router.post("/", protect, authorize("admin"), createBarangay);
router.put("/:id", protect, authorize("admin"), updateBarangay);
router.delete("/:id", protect, authorize("admin"), deleteBarangay);

module.exports = router;
