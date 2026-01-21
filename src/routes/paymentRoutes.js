import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  previewPayment,
  checkoutPayment,
  iyzicoCallback,
  adminApplyPayment,
} from "../controllers/paymentController.js";

const router = express.Router();

/* ===============================
   ÖN İZLEME (WEB PAYMENT PAGE)
   POST /api/payments/preview
=============================== */
router.post("/preview", previewPayment);

/* ===============================
   IYZICO CHECKOUT BAŞLAT
   POST /api/payments/checkout
   (LOGIN ZORUNLU)
=============================== */
router.post("/checkout", checkoutPayment);

/* ===============================
   IYZICO CALLBACK (PUBLIC)
   POST /api/payments/callback
=============================== */
router.get("/callback", iyzicoCallback);
router.post("/callback", iyzicoCallback);

router.post("/admin/apply/:paymentId", adminApplyPayment);

export default router;
