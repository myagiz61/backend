import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { SELLER_PLANS } from "../config/plans.js";
import { protect } from "../middleware/authMiddleware.js";
import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import { uploadTaxDoc } from "../middleware/uploadTaxDoc.js";
import { createAdminLog } from "../utils/createAdminLog.js";
import Subscription from "../models/Subscription.js";
import Listing from "../models/Listing.js";

const router = express.Router();

// helper: token üretme
const generateToken = (user) =>
  jwt.sign(
    { _id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

// POST /api/auth/register
router.post(
  "/register",
  uploadTaxDoc.single("taxDocument"),
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        password,
        role,
        storeName,
        taxOrTcNo,
        city,
        address,
      } = req.body;

      /* ================= DEBUG LOGS ================= */
      console.log("==== REGISTER BODY ====");
      console.log("name:", name);
      console.log("email:", email);
      console.log("phone:", phone);
      console.log("password:", password ? "VAR" : "YOK");
      console.log("role:", role);
      console.log("---- SELLER FIELDS ----");
      console.log("storeName:", storeName);
      console.log("taxOrTcNo:", taxOrTcNo);
      console.log("city:", city);
      console.log("address:", address);
      console.log("file:", req.file ? req.file.originalname : "DOSYA YOK");
      console.log("=======================");

      /* ================= BASIC VALIDATION ================= */
      if (!name || !email || !phone || !password || !role) {
        return res.status(400).json({ message: "Tüm alanlar zorunludur." });
      }

      if (!["buyer", "seller"].includes(role)) {
        return res.status(400).json({ message: "Geçersiz rol." });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "Bu email zaten kayıtlı." });
      }

      /* ================= SELLER VALIDATION ================= */
      if (role === "seller") {
        if (!req.file) {
          return res.status(400).json({
            message: "Vergi levhası (PDF) yüklemek zorunludur.",
          });
        }

        if (!storeName || !taxOrTcNo || !city || !address) {
          return res.status(400).json({
            message: "Firma bilgileri eksik.",
          });
        }
      }

      /* ================= CREATE USER ================= */
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await User.create({
        name,
        email,
        phone,
        passwordHash,
        role,
        storeName,
        taxOrTcNo,
        city,
        address,
        taxDocument:
          role === "seller"
            ? {
                fileName: req.file.originalname,
                filePath: req.file.path,
                mimeType: req.file.mimetype,
                uploadedAt: new Date(),
              }
            : undefined,
      });

      console.log("✅ USER CREATED:", user._id.toString());

      /* ================= ADMIN LOG (RESPONSE ÖNCESİ) ================= */
      if (role === "seller") {
        try {
          console.log("➡️ ADMIN LOG START");

          await createAdminLog({
            action: "SELLER_REGISTERED",
            message: `${email} satıcı başvurusu yaptı`,
            targetUserId: user._id,
            actor: "system",
          });

          console.log("✅ ADMIN LOG CREATED");
        } catch (logErr) {
          console.error("❌ ADMIN LOG ERROR:", logErr.message);
        }
      }

      /* ================= RESPONSE ================= */
      return res.status(201).json({
        message:
          role === "seller"
            ? "Başvurunuz alınmıştır. İnceleniyor."
            : "Kayıt başarılı.",
      });
    } catch (err) {
      console.error("❌ REGISTER ERROR:", err);
      return res.status(500).json({ message: err.message || "Sunucu hatası" });
    }
  }
);

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email ve şifre zorunludur." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Geçersiz bilgiler." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Geçersiz bilgiler." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Hesap pasif." });
    }

    // ❗ Seller verification burada ENGELLENMEZ

    if (role && role !== user.role) {
      return res
        .status(403)
        .json({ message: "Bu kullanıcı bu role sahip değil." });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      message: "Giriş başarılı.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isSellerVerified: user.isSellerVerified, // 🔥 KRİTİK
      },
      tokens: {
        accessToken: token,
        refreshToken: null,
      },
    });
  } catch (err) {
    console.error("Login hatası:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/buy-plan", protect, async (req, res) => {
  try {
    const { plan } = req.body;

    // Plan geçerli mi?
    if (!plan || !SELLER_PLANS[plan]) {
      return res.status(400).json({ message: "Geçersiz plan seçildi." });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    // Plan + 30 gün ekleme
    const now = new Date();
    const expires = new Date(now.setDate(now.getDate() + 30));

    user.plan = plan;
    user.planExpiresAt = expires;

    await user.save();

    res.json({
      message: "Premium plan başarıyla satın alındı.",
      plan: user.plan,
      expiresAt: user.planExpiresAt,
    });
  } catch (err) {
    console.error("BUY PLAN ERROR:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    console.log("========== /AUTH/ME START ==========");

    // 🔐 AUTH MIDDLEWARE'DEN GELEN USER
    console.log("REQ.USER (FROM PROTECT):", {
      id: req.user?._id,
      role: req.user?.role,
    });

    // 1️⃣ Kullanıcıyı DB'den tekrar çekiyoruz
    const user = await User.findById(req.user._id).select("-passwordHash");

    if (!user) {
      console.log("❌ USER NOT FOUND IN DB");
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    console.log("✅ USER FROM DB:", {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    // 🔥 KRİTİK KONTROL
    if (user.role !== "seller") {
      console.log("🚨 ROLE SELLER DEĞİL → EARLY RETURN");
      console.log("ROLE:", user.role);

      console.log("========== /AUTH/ME END (BUYER/ADMIN) ==========");
      return res.json({
        user,
        subscription: null,
        planInfo: null,
      });
    }

    console.log("🟢 ROLE SELLER → DEVAM");

    // 2️⃣ Aktif subscription
    const subscription = await Subscription.findOne({
      userId: user._id,
      isActive: true,
      endDate: { $gt: new Date() },
    }).populate("packageId");

    console.log(
      "SUBSCRIPTION:",
      subscription
        ? {
            id: subscription._id,
            package: subscription.packageId?.name,
            endDate: subscription.endDate,
          }
        : "YOK"
    );

    // 3️⃣ Plan adı
    let planName = "basic";

    if (subscription && subscription.packageId) {
      planName = subscription.packageId.name;
    }

    console.log("PLAN NAME:", planName);

    // 4️⃣ Plan config
    const planConfig = SELLER_PLANS[planName];
    console.log("PLAN CONFIG:", planConfig);

    // 5️⃣ Kullanılan ilan sayısı
    const usedListings = await Listing.countDocuments({
      seller: user._id,
      status: "ACTIVE",
    });

    const remainingListings =
      planConfig.maxListings === Infinity
        ? "unlimited"
        : Math.max(planConfig.maxListings - usedListings, 0);

    console.log("LISTINGS:", {
      usedListings,
      remainingListings,
    });

    console.log("========== /AUTH/ME END (SELLER) ==========");

    return res.json({
      user,
      subscription: subscription
        ? {
            package: subscription.packageId.name,
            endDate: subscription.endDate,
          }
        : null,
      planInfo: {
        plan: planName,
        maxListings: planConfig.maxListings,
        usedListings,
        remainingListings,
      },
    });
  } catch (err) {
    console.error("❌ /ME ERROR:", err);
    res.status(500).json({ message: "Kullanıcı bilgisi alınamadı" });
  }
});

router.post("/change-password", protect, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  const match = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!match) {
    return res.status(400).json({ message: "Eski şifre yanlış." });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: "Şifre başarıyla güncellendi." });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email zorunludur." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Bu email kayıtlı değil." });

    // Token üret
    const resetToken = randomBytes(32).toString("hex");

    // Token hashle ve kaydet
    user.resetPasswordToken = createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 dk
    await user.save();

    // GERÇEK URL (mailde görünür)
    const resetURL = `https://trphone.net/?token=${resetToken}`;

    // Mail gönder
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SUPPORT_MAIL,
        pass: process.env.SUPPORT_PASS,
      },
    });

    await transporter.sendMail({
      from: `"TRPHONE Destek" <${process.env.SUPPORT_MAIL}>`,
      to: user.email,
      subject: "Şifre Sıfırlama Talebi",
      text: `Şifre sıfırlama linki: ${resetURL}`,
      html: `
        <h2>Şifre Sıfırlama</h2>
        <p>Aşağıdaki link ile şifrenizi sıfırlayabilirsiniz:</p>
        <a href="${resetURL}" style="color:#1d4ed8">Şifreyi Sıfırla</a>
        <br/>
        <p>Link çalışmıyorsa: ${resetURL}</p>
        <p>Bu link yalnızca 15 dakika geçerlidir.</p>
      `,
    });

    return res.json({
      success: true,
      message: "Şifre sıfırlama linki email adresine gönderildi.",
    });
  } catch (err) {
    console.log("Forgot password error:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password)
      return res.status(400).json({ message: "Yeni şifre zorunludur." });

    const hashedToken = createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // Token geçerli mi?
    });

    if (!user)
      return res
        .status(400)
        .json({ message: "Token geçersiz veya süresi dolmuş." });

    // Şifreyi güncelle
    user.password = password;

    // Token'ları temizle
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.json({
      success: true,
      message: "Şifre başarıyla güncellendi.",
    });
  } catch (err) {
    console.log("Reset password error:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
