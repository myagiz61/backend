// src/routes/iapRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  verifyIapPayment,
  getMySubscriptionStatus,
} from "../controllers/iapController.js";

const router = express.Router();

// 🔥 TEK ENDPOINT (Premium + Boost)
router.post("/verify", protect, verifyIapPayment);

// 🔍 Premium aktif mi? (Boost için gerekmez)
router.get("/me", protect, getMySubscriptionStatus);

export default router;
