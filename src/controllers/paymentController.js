// src/controllers/paymentController.js

import mongoose from "mongoose";

import Payment from "../models/Payment.js";
import Package from "../models/Package.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import ListingBoost from "../models/ListingBoost.js";

import Iyzipay from "iyzipay";

/* =========================================================
   ENV / CONFIG
========================================================= */

const IYZICO_API_KEY = process.env.IYZICO_API_KEY;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const IYZICO_BASE_URL =
  process.env.IYZICO_BASE_URL || "https://api.iyzipay.com";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.trphone.net";

// BACKEND_URL mutlaka https:// ile olmalı (iyzico callback için kritik)
const rawBackendUrl =
  process.env.BACKEND_URL || "https://backend-production-bada.up.railway.app";

const BACKEND_URL = rawBackendUrl.startsWith("http")
  ? rawBackendUrl.replace(/\/+$/, "")
  : `https://${rawBackendUrl.replace(/\/+$/, "")}`;

if (!IYZICO_API_KEY || !IYZICO_SECRET_KEY) {
  console.error(
    "[IYZICO ENV ERROR] IYZICO_API_KEY / IYZICO_SECRET_KEY missing."
  );
}

const iyzico = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET_KEY,
  uri: IYZICO_BASE_URL,
});

/* =========================================================
   HELPERS
========================================================= */

const mapBoostDurationToPackageName = (duration) => {
  if (duration === "24h") return "boost_1_day";
  if (duration === "7d") return "boost_1_week";
  if (duration === "30d") return "boost_1_month";
  return null;
};

const buildProductName = (pkg) => {
  if (pkg.type === "membership")
    return `${String(pkg.name).toUpperCase()} PREMIUM`;
  if (pkg.type === "boost")
    return String(pkg.name).replaceAll("_", " ").toUpperCase();
  return pkg.name;
};

const pickClientIp = (req) => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0)
    return xff.split(",")[0].trim();
  return req.ip;
};

// iOS WebView için en stabil yönlendirme: HTML + JS
const sendRedirect = (res, url) => {
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Redirecting...</title>
      </head>
      <body>
        <script>
          window.location.href = "${url}";
        </script>
      </body>
    </html>
  `);
};

const iyzicoRetrieve = (token) =>
  new Promise((resolve, reject) => {
    iyzico.checkoutForm.retrieve({ token }, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
  });

/* =========================================================
   1) PREVIEW
========================================================= */

export const previewPayment = async (req, res) => {
  try {
    const { type, plan, duration, listingId } = req.body;

    if (!type) return res.status(400).json({ message: "Ödeme tipi eksik" });

    if (type === "premium") {
      if (!plan)
        return res.status(400).json({ message: "Paket bilgisi eksik" });

      const packageData = await Package.findOne({
        name: plan,
        type: "membership",
      });
      if (!packageData)
        return res.status(404).json({ message: "Paket bulunamadı" });

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
      if (!duration || !listingId)
        return res.status(400).json({ message: "Boost bilgileri eksik" });

      const boostName = mapBoostDurationToPackageName(duration);
      if (!boostName)
        return res.status(400).json({ message: "Geçersiz boost süresi" });

      const boostPackage = await Package.findOne({
        name: boostName,
        type: "boost",
      });
      if (!boostPackage)
        return res.status(404).json({ message: "Boost paketi bulunamadı" });

      const listing = await Listing.findById(listingId).select(
        "title brand model price"
      );
      if (!listing) return res.status(404).json({ message: "İlan bulunamadı" });

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
    const { type, plan, duration, listingId, userId, platform } = req.body;

    if (!type) return res.status(400).json({ message: "Ödeme tipi eksik" });

    if (!userId)
      return res.status(400).json({ message: "Kullanıcı bilgisi eksik" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    let pkg = null;

    /* ================= PREMIUM ================= */
    if (type === "premium") {
      if (!plan)
        return res.status(400).json({ message: "Paket bilgisi eksik" });

      pkg = await Package.findOne({ name: plan, type: "membership" });
      if (!pkg) return res.status(404).json({ message: "Paket bulunamadı" });
    }

    /* ================= BOOST ================= */
    if (type === "boost") {
      if (!duration || !listingId)
        return res.status(400).json({ message: "Boost bilgileri eksik" });

      const boostName = mapBoostDurationToPackageName(duration);
      if (!boostName)
        return res.status(400).json({ message: "Geçersiz boost süresi" });

      pkg = await Package.findOne({ name: boostName, type: "boost" });
      if (!pkg)
        return res.status(404).json({ message: "Boost paketi bulunamadı" });

      const listing = await Listing.findById(listingId).select("_id seller");
      if (!listing) return res.status(404).json({ message: "İlan bulunamadı" });

      if (String(listing.seller) !== String(userId)) {
        return res
          .status(403)
          .json({ message: "Bu ilana boost satın alamazsınız" });
      }
    }

    /* ================= PENDING KONTROL (DOĞRU YER) ================= */
    const existingPending = await Payment.findOne({
      userId,
      packageId: pkg._id,
      status: "pending",
    });

    if (existingPending) {
      return res.json({
        paymentId: existingPending._id,
        paymentPageUrl: existingPending.paymentPageUrl || null,
        message: "Zaten devam eden bir ödemeniz var",
      });
    }

    /* ================= PAYMENT CREATE ================= */
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
    const cbPlatform = platform || "mobile";

    const callbackUrl = `${BACKEND_URL}/api/payments/callback?platform=${encodeURIComponent(
      cbPlatform
    )}`;

    // (iyzico request aynen devam edebilir)

    const request = {
      locale: "tr",
      conversationId,
      price: String(pkg.price),
      paidPrice: String(pkg.price),
      currency: "TRY",
      basketId: conversationId,
      paymentGroup: "PRODUCT",
      callbackUrl,
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
      try {
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

        return res.json({
          paymentId: payment._id,
          paymentPageUrl: result.paymentPageUrl,
        });
      } catch (innerErr) {
        console.error("IYZICO INIT HANDLER ERROR:", innerErr);
        return res.status(500).json({ message: "Ödeme başlatma hatası" });
      }
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
    // token GET veya POST gelebilir
    const token = req.body?.token || req.query?.token;
    const platform = req.query?.platform;

    const isMobile = platform === "mobile";

    const SUCCESS_URL = isMobile
      ? "trphone://payment-success"
      : `${FRONTEND_URL}/odeme-basarili`;

    const FAIL_URL = isMobile
      ? "trphone://payment-failed"
      : `${FRONTEND_URL}/odeme-hata`;

    if (!token) return sendRedirect(res, FAIL_URL);

    const result = await iyzicoRetrieve(token);

    if (!result) return sendRedirect(res, FAIL_URL);

    const paymentId = result.conversationId;

    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return sendRedirect(res, FAIL_URL);
    }

    // pending -> processing kilidi
    const lockedPayment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: "pending" },
      { status: "processing" },
      { new: true }
    );

    if (!lockedPayment) {
      // zaten işlenmiş olabilir
      return sendRedirect(
        res,
        `${SUCCESS_URL}?pid=${paymentId}&duplicate=true`
      );
    }

    if (result.paymentStatus !== "SUCCESS") {
      await Payment.findByIdAndUpdate(paymentId, {
        status: "failed",
        failReason: result.errorMessage || "IYZICO_PAYMENT_FAILED",
        iyzicoResult: result,
      });

      return sendRedirect(res, FAIL_URL);
    }

    await applyPaymentSuccess(paymentId, result);

    return sendRedirect(res, `${SUCCESS_URL}?pid=${paymentId}`);
  } catch (err) {
    console.error("CALLBACK ERROR:", err);
    return sendRedirect(
      res,
      req.query?.platform === "mobile"
        ? "trphone://payment-failed"
        : `${FRONTEND_URL}/odeme-hata`
    );
  }
};

/* =========================================================
   4) SUCCESS APPLY (Kurumsal - idempotent + boost overlap)
========================================================= */

const applyPaymentSuccess = async (paymentId, iyzicoResult = null) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment bulunamadı");

  // idempotent
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
    const userId = req.user?._id;

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
    console.error("LEGACY initPayment ERROR:", err);
    return res.status(500).json({ message: "Ödeme başlatılamadı" });
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
