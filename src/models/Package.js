import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      // örnek: basic, standard, pro, boost_1_day
    },

    type: {
      type: String,
      enum: ["membership", "boost"],
      required: true,
    },

    // kaç gün geçerli
    durationDays: {
      type: Number,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Package", packageSchema);
