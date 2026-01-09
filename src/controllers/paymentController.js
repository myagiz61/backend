// src/controllers/paymentController.js
import Payment from "../models/Payment.js";
import Package from "../models/Package.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";

export const initPayment = async (req, res) => {
  try {
    const { planKey } = req.body;
    const userId = req.user._id;

    const pkg = await Package.findOne({ key: planKey });
    if (!pkg) {
      return res.status(404).json({ message: "Paket bulunamadı" });
    }

    const payment = await Payment.create({
      userId,
      packageId: pkg._id,
      amount: pkg.price,
      status: "pending",
    });

    // 🔥 KENDİ ÖDEME SAYFAN
    return res.json({
      paymentUrl: `https://mysiten.com/pay/${payment._id}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ödeme başlatılamadı" });
  }
};

export const paymentSuccess = async (req, res) => {
  try {
    const { paymentId } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment bulunamadı" });
    }

    if (payment.status === "success") {
      return res.json({ message: "Ödeme zaten işlenmiş" });
    }

    const pkg = await Package.findById(payment.packageId);
    if (!pkg) {
      return res.status(404).json({ message: "Paket bulunamadı" });
    }

    const now = new Date();

    /* ===============================
         1️⃣ ÜYELİK PAKETİ
      ================================ */
    if (pkg.type === "membership") {
      // eski üyelikleri kapat
      await Subscription.updateMany(
        { userId: payment.userId },
        { isActive: false }
      );

      const endDate = new Date(
        now.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000
      );

      await Subscription.create({
        userId: payment.userId,
        packageId: pkg._id,
        startDate: now,
        endDate,
        isActive: true,
      });

      // USER CACHE GÜNCELLE
      await User.findByIdAndUpdate(payment.userId, {
        plan: pkg.name, // basic | standard | pro
        planExpiresAt: endDate,
      });

      await Notification.create({
        user: payment.userId,
        title: "Üyelik Aktif",
        message: `${pkg.name} paketiniz aktif edildi.`,
      });
    }

    /* ===============================
         2️⃣ BOOST PAKETİ
      ================================ */
    if (pkg.type === "boost") {
      if (!payment.listingId) {
        return res.status(400).json({ message: "Boost için listingId eksik" });
      }

      const listing = await Listing.findById(payment.listingId);
      if (!listing) {
        return res.status(404).json({ message: "İlan bulunamadı" });
      }

      const endDate = new Date(
        now.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000
      );

      await ListingBoost.create({
        listingId: listing._id,
        sellerId: payment.userId,
        packageId: pkg._id,
        startDate: now,
        endDate,
        isActive: true,
      });

      listing.isBoosted = true;
      listing.boostExpiresAt = endDate;
      await listing.save();

      await Notification.create({
        user: payment.userId,
        title: "Boost Aktif",
        message: `${listing.title} ilanınız ${pkg.durationDays} gün öne çıkarıldı.`,
      });
    }

    // Ödeme başarılı
    payment.status = "success";
    await payment.save();

    res.json({ message: "Ödeme başarıyla tamamlandı" });
  } catch (err) {
    console.error("paymentSuccess ERROR:", err);
    res.status(500).json({ message: "Ödeme işlenemedi" });
  }
};

export const previewPayment = async (req, res) => {
  try {
    const { type, plan, duration, listingId } = req.body;

    /* ================= VALIDATION ================= */
    if (!type) {
      return res.status(400).json({
        message: "Ödeme tipi eksik",
      });
    }

    /* ================= PREMIUM ================= */
    if (type === "premium") {
      if (!plan) {
        return res.status(400).json({
          message: "Paket bilgisi eksik",
        });
      }

      const packageData = await Package.findOne({ name: plan });

      if (!packageData) {
        return res.status(404).json({
          message: "Paket bulunamadı",
        });
      }

      return res.json({
        type: "premium",
        product: {
          name: packageData.name.toUpperCase() + " Premium",
          price: packageData.price,
        },
      });
    }

    /* ================= BOOST ================= */
    if (type === "boost") {
      if (!duration || !listingId) {
        return res.status(400).json({
          message: "Boost bilgileri eksik",
        });
      }

      const boostPackage = await Package.findOne({
        name:
          duration === "24h"
            ? "boost_1_day"
            : duration === "7d"
            ? "boost_1_week"
            : "boost_1_month",
      });

      if (!boostPackage) {
        return res.status(404).json({
          message: "Boost paketi bulunamadı",
        });
      }

      return res.json({
        type: "boost",
        product: {
          name: boostPackage.name.replaceAll("_", " ").toUpperCase(),
          price: boostPackage.price,
        },
        meta: {
          listingId,
        },
      });
    }

    /* ================= FALLBACK ================= */
    return res.status(400).json({
      message: "Geçersiz ödeme tipi",
    });
  } catch (err) {
    console.error("PAYMENT PREVIEW ERROR:", err);

    // 🔴 BU ÇOK ÖNEMLİ
    return res.status(500).json({
      message: "Sunucu hatası",
    });
  }
};
