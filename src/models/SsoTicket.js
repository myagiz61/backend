import mongoose from "mongoose";

const ssoTicketSchema = new mongoose.Schema(
  {
    ticket: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Otomatik silinsin (TTL)
ssoTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SsoTicket", ssoTicketSchema);
