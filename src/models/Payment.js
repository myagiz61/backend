// src/models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    // Boost ise dolu, üyelikte null
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    /* =====================================================
       STATUS (CRITICAL)
       - pending     : iyzico init edildi
       - processing  : callback lock alındı
       - success     : haklar verildi
       - failed      : ödeme başarısız
    ===================================================== */
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed"],
      default: "pending",
      index: true,
    },

    provider: {
      type: String,
      enum: ["iyzico", "manual", "bank"],
      default: "iyzico",
    },

    /* =====================================================
       IYZICO FIELDS
    ===================================================== */
    iyzicoToken: {
      type: String,
      default: null,
      index: true,
    },

    iyzicoResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    failReason: {
      type: String,
      default: null,
    },

    /* =====================================================
       AUDIT / META
    ===================================================== */
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      /*
        örnek:
        {
          type: "premium" | "boost",
          plan: "basic",
          duration: "7d"
        }
      */
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Payment", paymentSchema);
