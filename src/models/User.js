import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },
    fcmToken: {
      type: String,
    },

    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      required: true,
    },

    /* ================= SELLER INFO ================= */

    city: {
      type: String,
      required: function () {
        return this.role === "seller";
      },
    },

    storeName: {
      type: String,
      required: function () {
        return this.role === "seller";
      },
    },

    taxDocument: {
      fileName: String, // ornek.pdf
      filePath: String, // /uploads/tax/xxx.pdf
      mimeType: String, // application/pdf
      uploadedAt: Date,
    },

    address: {
      type: String,
      required: function () {
        return this.role === "seller";
      },
    },

    taxOrTcNo: {
      type: String,
      required: function () {
        return this.role === "seller";
      },
    },

    isSellerVerified: {
      type: Boolean,
      default: false,
    },

    /* ================= ACCOUNT STATUS ================= */

    isActive: {
      type: Boolean,
      default: true,
    },

    /* ================= PLAN (CACHE / SNAPSHOT) =================
       ❗ GERÇEK KAYNAK: Subscription collection
       ❗ Bu alanlar sadece hızlı kontrol içindir
    */

    plan: {
      type: String,
      enum: ["free", "basic", "standard", "pro"],
      required: function () {
        return this.role === "seller";
      },
      default: function () {
        return this.role === "seller" ? "free" : undefined;
      },
    },

    planExpiresAt: {
      type: Date,
      default: function () {
        return this.role === "seller" ? null : undefined;
      },
    },

    /* ================= PASSWORD RESET ================= */

    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
