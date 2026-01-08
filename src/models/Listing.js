import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    storage: { type: String, required: true },

    condition: {
      type: String,
      enum: ["Sıfır", "İkinci El"],
      required: true,
    },

    price: { type: Number, required: true },

    images: [{ type: String }],

    // 🔥 DÜZELTİLDİ → Tek renk
    color: { type: String },

    warranty: { type: String },

    // Pil Sağlığı (%)
    batteryHealth: { type: Number },

    city: { type: String, required: true },
    description: { type: String },

    status: {
      type: String,
      enum: ["ACTIVE", "PASSIVE"],
      default: "ACTIVE",
    },
  },

  { timestamps: true }
);

export default mongoose.model("Listing", listingSchema);
