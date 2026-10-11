
const express = require("express");
const router = express.Router();

const { register, login } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post("/register", register);
router.post("/login", login);

// Protected route: logged-in user's details
router.get("/me", authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user fetched successfully",
    user: req.user,
  });
});

router.get(
  "/student-dashboard",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Welcome to Student Dashboard",
      user: req.user,
    });
  }
);

module.exports = router;