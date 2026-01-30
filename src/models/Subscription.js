import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ⬇️ iyzico / manuel için (Aynen kalıyor)
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /* ================= IAP (iOS) EK ALANLAR ================= */

    platform: {
      type: String,
      enum: ["web", "ios"],
      default: "web",
    },

    productId: {
      type: String, // com.trphone.premium.monthly
      default: null,
    },

    transactionId: {
      type: String,
      default: null,
    },

    originalTransactionId: {
      type: String,
      default: null,
    },

    // Apple response (opsiyonel – debug için)
    applePayload: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);
