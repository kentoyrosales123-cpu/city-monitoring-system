const express = require("express");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  updateMyStatus,
} = require("../controllers/userController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("admin", "commander"), getUsers);
router.post("/", protect, authorize("admin"), createUser);
router.put("/:id", protect, authorize("admin"), updateUser);
router.delete("/:id", protect, authorize("admin"), deleteUser);

router.put(
  "/me/status",
  protect,
  authorize("responder", "police", "fire", "medical", "drrm", "barangay"),
  updateMyStatus
);

module.exports = router;