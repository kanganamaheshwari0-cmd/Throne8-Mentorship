const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { verifyMentor } = require("../controllers/adminController");

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin account required.",
    });
  }

  next();
};

router.patch(
  "/mentors/:mentorId/verify",
  authMiddleware,
  adminOnly,
  verifyMentor
);

module.exports = router;