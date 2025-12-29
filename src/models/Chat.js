import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    buyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    lastMessage: { type: String },
    storeName: { type: String }, // 🔥 EKLENDİ
    // 🔥 buyer için okunmamış sayısı
    buyerUnreadCount: { type: Number, default: 0 },
    sellerUnreadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export default mongoose.model("Chat", chatSchema);
