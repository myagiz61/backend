import express from "express";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import AdminLog from "../models/AdminLog.js";
import { createAdminLog } from "../utils/createAdminLog.js";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { sendMail } from "../utils/sendMail.js";
import path from "path";
import { safeDeleteFile } from "../utils/deleteFile.js";
const router = express.Router();

/* ================= USERS ================= */

router.use((req, res, next) => {
  console.log("🔥 ADMIN ROUTE HIT:", req.method, req.originalUrl);
  next();
});
// Kullanıcıları listele
router.get("/users", async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

// Kullanıcıyı aktif/pasif yap
router.patch("/users/:id/toggle", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "Kullanıcı bulunamadı" });
  }

  user.isActive = !user.isActive;
  await user.save();

  await createAdminLog({
    adminId: req.admin._id,
    action: "USER_STATUS_TOGGLE",
    message: `${user.email} durumu ${user.isActive ? "aktif" : "pasif"}`,
    targetUserId: user._id,
  });

  res.json({
    success: true,
    isActive: user.isActive,
  });
});

router.get("/dashboard", verifyAdmin, async (req, res) => {
  try {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const start7d = new Date(now);
    start7d.setDate(start7d.getDate() - 6);
    start7d.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalSellers,
      totalAdmins,
      activeUsers,
      pendingSellers,
      totalListings,
      activeListings,
      todaySignups,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "seller" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({
        role: "seller",
        isSellerVerified: false,
        isActive: true,
      }),
      Listing.countDocuments({}),
      Listing.countDocuments({ status: "active" }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
    ]);

    const signups7d = await User.aggregate([
      { $match: { createdAt: { $gte: start7d } } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    const roleDist = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("email role isActive createdAt");

    res.json({
      success: true,
      kpis: {
        totalUsers,
        totalSellers,
        totalAdmins,
        activeUsers,
        pendingSellers,
        totalListings,
        activeListings,
        todaySignups,
      },
      charts: {
        signups7d,
        roleDist,
      },
      recent: {
        recentUsers,
      },
      meta: {
        generatedAt: now.toISOString(),
      },
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).json({ message: "Dashboard verisi alınamadı." });
  }
});

// Satıcıları listele
router.get("/sellers", verifyAdmin, async (req, res) => {
  const { status } = req.query;

  const filter = { role: "seller" };
  if (status === "pending") filter.isSellerVerified = false;
  if (status === "approved") filter.isSellerVerified = true;

  const sellers = await User.find(filter).select(
    "email isSellerVerified isActive createdAt"
  );

  res.json({ success: true, sellers });
});

router.get("/sellers/pending", async (req, res) => {
  console.log("✅ SELLERS PENDING CONTROLLER ÇALIŞTI");
  console.log("USER:", req.user?._id, req.user?.role);

  const sellers = await User.find({
    role: "seller",
    isSellerVerified: false,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .select("email role isActive isSellerVerified createdAt");

  res.json({ success: true, sellers });
});

router.get("/sellers/:id", async (req, res) => {
  const seller = await User.findOne({
    _id: req.params.id,
    role: "seller",
  }).select(
    "email phone role storeName taxOrTcNo city address taxDocument createdAt"
  );

  if (!seller) {
    return res.status(404).json({ message: "Satıcı bulunamadı" });
  }

  res.json({ seller });
});

router.patch("/sellers/:id/approve", async (req, res) => {
  try {
    const seller = await User.findOne({
      _id: req.params.id,
      role: "seller",
    });

    if (!seller) {
      return res.status(404).json({ message: "Satıcı bulunamadı" });
    }

    // 1️⃣ Seller onayla
    seller.isSellerVerified = true;
    await seller.save();

    // 2️⃣ Admin log
    await createAdminLog({
      adminId: req.user._id,
      action: "SELLER_APPROVED",
      message: `${seller.email} satıcı olarak onaylandı`,
      targetUserId: seller._id,
    });

    // 3️⃣ Notification (DB)
    const notif = await Notification.create({
      user: seller._id,
      title: "Satıcı Hesabınız Onaylandı",
      message:
        "Satıcı hesabınız onaylandı. Artık TRPHONE’da ilan verebilirsiniz.",
      type: "SELLER_APPROVED",
      isRead: false,
    });

    // 4️⃣ Socket
    const io = req.app.get("io");
    if (io) {
      io.to(String(seller._id)).emit("notification:new", notif);
    }

    // 5️⃣ Email
    await sendMail({
      to: seller.email,
      subject: "TRPHONE - Satıcı Başvurunuz Onaylandı",
      text: "Satıcı hesabınız onaylandı. TRPHONE uygulamasına giriş yaparak ilan verebilirsiniz.",
      html: `
        <h2>Satıcı Başvurunuz Onaylandı</h2>
        <p>Merhaba,</p>
        <p>Satıcı hesabınız onaylandı. TRPHONE uygulamasına giriş yaparak ilan verebilirsiniz.</p>
        <p>İyi satışlar dileriz.</p>
        <hr/>
        <small>TRPHONE Destek</small>
      `,
    });

    return res.json({ success: true, message: "Satıcı onaylandı." });
  } catch (err) {
    console.error("SELLER APPROVE ERROR:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.patch("/sellers/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // 1️⃣ ID + reason kontrol
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz satıcı ID" });
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ message: "Reddetme nedeni zorunludur." });
    }

    const seller = await User.findOne({
      _id: id,
      role: "seller",
    });

    if (!seller) {
      return res.status(404).json({ message: "Satıcı bulunamadı" });
    }

    // 2️⃣ Vergi / belge dosyası sil (SAFE)
    safeDeleteFile(seller.taxDocument);

    // 3️⃣ Admin log (silmeden önce!)
    await createAdminLog({
      adminId: req.user._id,
      action: "SELLER_REJECTED",
      message: `${seller.email} satıcı başvurusu reddedildi ve sistemden silindi`,
      targetUserId: seller._id,
      meta: { reason },
    });

    // 4️⃣ Notification
    const notif = await Notification.create({
      user: seller._id,
      title: "Satıcı Başvurusu Reddedildi",
      message: `Satıcı başvurunuz reddedildi. Neden: ${reason}`,
      type: "SELLER_REJECTED",
      isRead: false,
    });

    // 5️⃣ Socket
    const io = req.app.get("io");
    if (io) {
      io.to(String(seller._id)).emit("notification:new", notif);
    }

    // 6️⃣ Email
    await sendMail({
      to: seller.email,
      subject: "TRPHONE - Satıcı Başvurusu Reddedildi",
      text: `Satıcı başvurunuz reddedildi. Neden: ${reason}`,
      html: `
        <h2>Satıcı Başvurunuz Reddedildi</h2>
        <p><b>Neden:</b> ${reason}</p>
        <p>Eksikleri düzelttikten sonra tekrar başvurabilirsiniz.</p>
        <hr/>
        <small>TRPHONE Destek</small>
      `,
    });

    // 🗑 7️⃣ User'ı tamamen sil
    await User.deleteOne({ _id: seller._id });

    return res.json({
      success: true,
      message: "Satıcı reddedildi ve sistemden tamamen silindi.",
    });
  } catch (err) {
    console.error("SELLER REJECT ERROR:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// 🔹 Admin Logları
router.get("/logs", verifyAdmin, async (req, res) => {
  const logs = await AdminLog.find()
    .populate("adminId", "email")
    .populate("targetUserId", "email")
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, logs });
});

router.get("/sellers/:id/tax-document", verifyAdmin, async (req, res) => {
  try {
    const seller = await User.findById(req.params.id);

    if (!seller || !seller.taxDocument) {
      return res.status(404).json({ message: "Belge bulunamadı" });
    }

    // taxDocument string veya object olabilir
    const filePath =
      typeof seller.taxDocument === "string"
        ? seller.taxDocument
        : seller.taxDocument.path;

    const absPath = path.resolve(filePath);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: "Dosya mevcut değil" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");

    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    console.error("PDF VIEW ERROR:", err);
    res.status(500).json({ message: "PDF görüntülenemedi" });
  }
});
export default router;
