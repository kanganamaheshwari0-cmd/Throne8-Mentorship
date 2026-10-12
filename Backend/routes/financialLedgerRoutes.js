const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getMentorFinancialLedger,
} = require("../controllers/financialLedgerController");

router.get("/mentor", authMiddleware, getMentorFinancialLedger);

module.exports = router;