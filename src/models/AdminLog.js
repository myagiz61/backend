import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.actor === "admin";
      },
    },
    actor: {
      type: String,
      enum: ["admin", "system"],
      default: "admin",
      required: true,
    },

    action: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    meta: Object,
  },
  { timestamps: true }
);

export default mongoose.model("AdminLog", adminLogSchema);
