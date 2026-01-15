// src/controllers/paymentController.js

import Payment from "../models/Payment.js";
import Package from "../models/Package.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import ListingBoost from "../models/ListingBoost.js";

import Iyzipay from "iyzipay";

/* =========================================================
   IYZICO CLIENT (Kurumsal)
========================================================= */

const IYZICO_API_KEY = process.env.IYZICO_API_KEY;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const IYZICO_BASE_URL =
  process.env.IYZICO_BASE_URL || "https://api.iyzipay.com";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.trphone.net";
const BACKEND_URL =
  process.env.BACKEND_URL || "https://backend-e5v0.onrender.com";

// ✅ Env guard (apiKey empty hatasını kökten bitirir)
if (!IYZICO_API_KEY || !IYZICO_SECRET_KEY) {
  console.error(
    "[IYZICO ENV ERROR] IYZICO_API_KEY / IYZICO_SECRET_KEY missing. Check backend/.env"
  );
}

const iyzico = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET_KEY,
  uri: IYZICO_BASE_URL,
});

/* =========================================================
   Helpers
========================================================= */

const mapBoostDurationToPackageName = (duration) => {
  if (duration === "24h") return "boost_1_day";
  if (duration === "7d") return "boost_1_week";
  if (duration === "30d") return "boost_1_month";
  return null;
};

const buildProductName = (pkg) => {
  if (pkg.type === "membership") return `${pkg.name.toUpperCase()} PREMIUM`;
  if (pkg.type === "boost") return pkg.name.replaceAll("_", " ").toUpperCase();
  return pkg.name;
};

const pickClientIp = (req) => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0)
    return xff.split(",")[0].trim();
  return req.ip;
};

/* =========================================================
   1) PREVIEW
========================================================= */

export const previewPayment = async (req, res) => {
  try {
    const { type, plan, duration, listingId } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Ödeme tipi eksik" });
    }

    if (type === "premium") {
      if (!plan)
        return res.status(400).json({ message: "Paket bilgisi eksik" });

      const packageData = await Package.findOne({
        name: plan,
        type: "membership",
      });

      if (!packageData) {
        return res.status(404).json({ message: "Paket bulunamadı" });
      }

      return res.json({
        type: "premium",
        product: {
          name: buildProductName(packageData),
          price: packageData.price,
          currency: "TRY",
        },
      });
    }

    if (type === "boost") {
      if (!duration || !listingId) {
        return res.status(400).json({ message: "Boost bilgileri eksik" });
      }

      const boostName = mapBoostDurationToPackageName(duration);
      if (!boostName) {
        return res.status(400).json({ message: "Geçersiz boost süresi" });
      }

      const boostPackage = await Package.findOne({
        name: boostName,
        type: "boost",
      });

      if (!boostPackage) {
        return res.status(404).json({ message: "Boost paketi bulunamadı" });
      }

      const listing = await Listing.findById(listingId).select(
        "title brand model price"
      );
      if (!listing) {
        return res.status(404).json({ message: "İlan bulunamadı" });
      }

      return res.json({
        type: "boost",
        product: {
          name: buildProductName(boostPackage),
          price: boostPackage.price,
          currency: "TRY",
        },
        meta: {
          listingId,
          listingTitle:
            listing.title ||
            `${listing.brand || ""} ${listing.model || ""}`.trim(),
          listingPrice: listing.price,
        },
      });
    }

    return res.status(400).json({ message: "Geçersiz ödeme tipi" });
  } catch (err) {
    console.error("PAYMENT PREVIEW ERROR:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
};

/* =========================================================
   2) CHECKOUT (iyzico başlat)
========================================================= */

export const checkoutPayment = async (req, res) => {
  try {
    const { type, plan, duration, listingId, userId } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Ödeme tipi eksik" });
    }

    if (!userId) {
      return res.status(400).json({ message: "Kullanıcı bilgisi eksik" });
    }

    // 🔐 Kullanıcıyı DB’den al
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    let pkg = null;

    /* ================= PREMIUM ================= */
    if (type === "premium") {
      if (!plan) {
        return res.status(400).json({ message: "Paket bilgisi eksik" });
      }

      pkg = await Package.findOne({ name: plan, type: "membership" });
      if (!pkg) {
        return res.status(404).json({ message: "Paket bulunamadı" });
      }
    }

    /* ================= BOOST ================= */
    if (type === "boost") {
      if (!duration || !listingId) {
        return res.status(400).json({ message: "Boost bilgileri eksik" });
      }

      const boostName = mapBoostDurationToPackageName(duration);
      if (!boostName) {
        return res.status(400).json({ message: "Geçersiz boost süresi" });
      }

      pkg = await Package.findOne({ name: boostName, type: "boost" });
      if (!pkg) {
        return res.status(404).json({ message: "Boost paketi bulunamadı" });
      }

      const listing = await Listing.findById(listingId).select("_id seller");
      if (!listing) {
        return res.status(404).json({ message: "İlan bulunamadı" });
      }

      // 🔴 Artık req.user yok → userId ile kontrol
      if (listing.seller.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Bu ilana boost satın alamazsınız" });
      }
    }

    /* ================= PAYMENT RECORD ================= */
    const payment = await Payment.create({
      userId,
      packageId: pkg._id,
      listingId: type === "boost" ? listingId : null,
      amount: pkg.price,
      status: "pending",
      provider: "iyzico",
      meta: {
        type,
        plan: plan || null,
        duration: duration || null,
      },
    });

    const conversationId = payment._id.toString();

    /* ================= IYZICO REQUEST ================= */
    const request = {
      locale: "tr",
      conversationId,
      price: String(pkg.price),
      paidPrice: String(pkg.price),
      currency: "TRY",
      basketId: conversationId,
      paymentGroup: "PRODUCT",
      callbackUrl: `${BACKEND_URL}/api/payments/callback`,
      enabledInstallments: [1],

      buyer: {
        id: user._id.toString(),
        name: user.name || "TRPHONE",
        surname: user.surname || "USER",
        email: user.email,
        identityNumber: user.identityNumber || "00000000000",
        registrationAddress: "Türkiye",
        ip: pickClientIp(req),
        city: "Istanbul",
        country: "Turkey",
      },

      shippingAddress: {
        contactName: `${user.name || "TRPHONE"} ${user.surname || "USER"}`,
        city: "Istanbul",
        country: "Turkey",
        address: "Türkiye",
      },

      billingAddress: {
        contactName: `${user.name || "TRPHONE"} ${user.surname || "USER"}`,
        city: "Istanbul",
        country: "Turkey",
        address: "Türkiye",
      },

      basketItems: [
        {
          id: pkg._id.toString(),
          name: buildProductName(pkg),
          category1: type,
          itemType: "VIRTUAL",
          price: String(pkg.price),
        },
      ],
    };

    iyzico.checkoutFormInitialize.create(request, async (err, result) => {
      if (err) {
        console.error("IYZICO INIT ERR:", err);
        await Payment.findByIdAndUpdate(payment._id, {
          status: "failed",
          failReason: "IYZICO_INIT_ERROR",
        });
        return res.status(500).json({ message: "iyzico başlatılamadı" });
      }

      if (!result || result.status !== "success") {
        console.error("IYZICO INIT FAIL:", result);
        await Payment.findByIdAndUpdate(payment._id, {
          status: "failed",
          failReason: result?.errorMessage || "IYZICO_INIT_FAILED",
        });
        return res
          .status(400)
          .json({ message: result?.errorMessage || "Ödeme başlatılamadı" });
      }

      await Payment.findByIdAndUpdate(payment._id, {
        iyzicoToken: result.token,
      });

      return res.json({
        paymentId: payment._id,
        checkoutFormContent: result.checkoutFormContent,
      });
    });
  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    return res.status(500).json({ message: "Ödeme başlatılamadı" });
  }
};

/* =========================================================
   3) CALLBACK (iyzico dönüş) - ATOMIC/IDEMPOTENT
========================================================= */

export const iyzicoCallback = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) return res.redirect(`${FRONTEND_URL}/odeme-hata`);

    iyzico.checkoutForm.retrieve({ token }, async (err, result) => {
      if (err) {
        console.error("IYZICO RETRIEVE ERR:", err);
        return res.redirect(`${FRONTEND_URL}/odeme-hata`);
      }

      if (!result || result.status !== "success") {
        console.error("IYZICO RETRIEVE FAIL:", result);
        return res.redirect(`${FRONTEND_URL}/odeme-hata`);
      }

      const paymentStatus = result.paymentStatus; // SUCCESS | FAILURE
      const paymentId = result.conversationId;

      if (!paymentId) return res.redirect(`${FRONTEND_URL}/odeme-hata`);

      // ✅ ATOMIC LOCK: pending -> processing
      const lockedPayment = await Payment.findOneAndUpdate(
        { _id: paymentId, status: "pending" },
        { status: "processing" },
        { new: true }
      );

      // Eğer yoksa: ya zaten işlendi (success/failed) ya da id yanlış.
      if (!lockedPayment) {
        // Kullanıcı deneyimi için idempotent başarı sayfasına basabiliriz:
        return res.redirect(`${FRONTEND_URL}/odeme-basarili`);
      }

      if (paymentStatus !== "SUCCESS") {
        await Payment.findByIdAndUpdate(paymentId, {
          status: "failed",
          failReason: result.errorMessage || "IYZICO_PAYMENT_FAILED",
          iyzicoResult: result,
        });
        return res.redirect(`${FRONTEND_URL}/odeme-hata`);
      }

      await applyPaymentSuccess(paymentId, result);

      return res.redirect(`${FRONTEND_URL}/odeme-basarili?pid=${paymentId}`);
    });
  } catch (err) {
    console.error("CALLBACK ERROR:", err);
    return res.redirect(`${FRONTEND_URL}/odeme-hata`);
  }
};

/* =========================================================
   4) SUCCESS APPLY (Kurumsal - idempotent + boost overlap)
========================================================= */

const applyPaymentSuccess = async (paymentId, iyzicoResult = null) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment bulunamadı");

  // ✅ idempotent: processing/success kontrol
  if (payment.status === "success") return;

  const pkg = await Package.findById(payment.packageId);
  if (!pkg) throw new Error("Paket bulunamadı");

  const now = new Date();

  if (pkg.type === "membership") {
    await Subscription.updateMany(
      { userId: payment.userId },
      { isActive: false }
    );

    const endDate = new Date(now.getTime() + pkg.durationDays * 86400000);

    await Subscription.create({
      userId: payment.userId,
      packageId: pkg._id,
      startDate: now,
      endDate,
      isActive: true,
    });

    await User.findByIdAndUpdate(payment.userId, {
      plan: pkg.name,
      planExpiresAt: endDate,
    });

    await Notification.create({
      user: payment.userId,
      title: "Üyelik Aktif",
      message: `${pkg.name} paketiniz aktif edildi.`,
    });
  }

  if (pkg.type === "boost") {
    if (!payment.listingId) throw new Error("Boost için listingId eksik");

    const listing = await Listing.findById(payment.listingId);
    if (!listing) throw new Error("İlan bulunamadı");

    const endDate = new Date(now.getTime() + pkg.durationDays * 86400000);

    // ✅ Overlap kapat: önceki aktif boostları pasifle
    await ListingBoost.updateMany(
      { listingId: listing._id, isActive: true },
      { isActive: false }
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

  // ✅ finalize
  payment.status = "success";
  payment.iyzicoResult = iyzicoResult;
  await payment.save();
};

/* =========================================================
   5) Legacy
========================================================= */

export const initPayment = async (req, res) => {
  try {
    const { planKey } = req.body;
    const userId = req.user._id;

    const pkg = await Package.findOne({ key: planKey });
    if (!pkg) return res.status(404).json({ message: "Paket bulunamadı" });

    const payment = await Payment.create({
      userId,
      packageId: pkg._id,
      amount: pkg.price,
      status: "pending",
      provider: "manual",
    });

    return res.json({
      paymentId: payment._id,
      message:
        "Legacy ödeme kaydı açıldı. Kurumsal akış için /checkout kullanın.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ödeme başlatılamadı" });
  }
};

export const paymentSuccess = async (req, res) => {
  try {
    const { paymentId } = req.body;

    await applyPaymentSuccess(paymentId);

    return res.json({ message: "Ödeme başarıyla tamamlandı" });
  } catch (err) {
    console.error("paymentSuccess ERROR:", err);
    return res.status(500).json({ message: "Ödeme işlenemedi" });
  }
};
