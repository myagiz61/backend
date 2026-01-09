// src/routes/paymentRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  initPayment,
  paymentSuccess,
  previewPayment,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/init", protect, initPayment);
router.post("/success", paymentSuccess); // banka döner
// routes/paymentRoutes.js
router.post("/preview", previewPayment);

export default router;
