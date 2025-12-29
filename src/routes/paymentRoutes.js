// src/routes/paymentRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  initPayment,
  paymentSuccess,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/init", protect, initPayment);
router.post("/success", paymentSuccess); // banka döner

export default router;
