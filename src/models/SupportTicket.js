import mongoose from "mongoose";

const SupportTicketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "read", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SupportTicket", SupportTicketSchema);
