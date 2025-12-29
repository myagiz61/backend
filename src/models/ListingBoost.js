// models/ListingBoost.js
import mongoose from "mongoose";

const listingBoostSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    boostType: {
      type: String,
      enum: ["DAY_1", "WEEK_1", "MONTH_1"],
      required: true,
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ListingBoost", listingBoostSchema);
