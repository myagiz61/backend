// src/controllers/iapController.js

import axios from "axios";
import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import Package from "../models/Package.js";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import ListingBoost from "../models/ListingBoost.js";
import Notification from "../models/Notification.js";

/* ================= CONFIG ================= */

const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

const APPLE_VERIFY_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_VERIFY_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

/* ===== PRODUCT MAPS ===== */

const PREMIUM_MAP = {
  "trphone.premium.basic1": "basic",
  "trphone.premium.standard": "standard",
  "trphone.premium.pro": "pro",
};

const BOOST_MAP = {
  "trphone.featured.1day": 1,
  "trphone.featured.7day": 7,
  "trphone.featured.30day": 30,
};

/* ================= HELPERS ================= */

const verifyApple = async (receiptData, sandbox = false) => {
  const url = sandbox ? APPLE_VERIFY_SANDBOX : APPLE_VERIFY_PROD;

  const { data } = await axios.post(url, {
    "receipt-data": receiptData,
    password: APPLE_SHARED_SECRET,
    "exclude-old-transactions": true,
  });

  return data;
};

const msToDate = (ms) => new Date(Number(ms));

/* ================= SINGLE VERIFY ================= */

export const verifyIapPayment = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { receiptData, productId, listingId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Yetkisiz" });
    }

    if (!receiptData || !productId) {
      return res
        .status(400)
        .json({ message: "receiptData ve productId zorunlu" });
    }

    /* =====================================================
       MOCK MODE (POSTMAN / DEV TEST)
    ===================================================== */
    if (
      process.env.ALLOW_MOCK_IAP === "true" &&
      receiptData === "TEST_RECEIPT_DATA"
    ) {
      const now = new Date();

      /* ===== MOCK PREMIUM ===== */
      if (PREMIUM_MAP[productId]) {
        const endDate = new Date(now.getTime() + 30 * 86400000);

        const premiumPackage = await Package.findOne({
          type: "membership",
          name: PREMIUM_MAP[productId],
        });

        await Subscription.updateMany(
          { userId, isActive: true },
          { isActive: false }
        );

        await Subscription.create({
          userId,
          packageId: premiumPackage._id,
          startDate: now,
          endDate,
          isActive: true,
        });

        await User.findByIdAndUpdate(userId, {
          plan: PREMIUM_MAP[productId],
          planExpiresAt: endDate,
        });

        return res.json({
          ok: true,
          mock: true,
          type: "subscription",
          plan: PREMIUM_MAP[productId],
          endDate,
        });
      }

      /* ===== MOCK BOOST ===== */
      if (BOOST_MAP[productId]) {
        if (!listingId) {
          return res.status(400).json({ message: "listingId zorunlu" });
        }

        const days = BOOST_MAP[productId];
        const endDate = new Date(now.getTime() + days * 86400000);

        await ListingBoost.updateMany(
          { listingId, isActive: true },
          { isActive: false }
        );

        await ListingBoost.create({
          listingId,
          sellerId: userId,
          startDate: now,
          endDate,
          isActive: true,
          source: "mock",
          productId,
        });

        await Listing.findByIdAndUpdate(listingId, {
          isBoosted: true,
          boostExpiresAt: endDate,
        });

        return res.json({
          ok: true,
          mock: true,
          type: "boost",
          listingId,
          endDate,
        });
      }
    }

    /* =====================================================
       APPLE VERIFY (PRODUCTION)
    ===================================================== */

    let appleRes = await verifyApple(receiptData, false);
    if (appleRes.status === 21007) {
      appleRes = await verifyApple(receiptData, true);
    }

    if (appleRes.status !== 0) {
      return res.status(400).json({ message: "Apple doğrulama başarısız" });
    }

    const latest = appleRes.latest_receipt_info?.[0];
    if (!latest) {
      return res.status(400).json({ message: "Receipt bulunamadı" });
    }

    const transactionId = latest.transaction_id;

    /* ================= PREMIUM ================= */

    if (PREMIUM_MAP[productId]) {
      const startDate = msToDate(latest.purchase_date_ms);
      const endDate = msToDate(latest.expires_date_ms);

      if (!endDate) {
        return res.status(400).json({ message: "Subscription süresi yok" });
      }

      const premiumPackage = await Package.findOne({
        type: "membership",
        name: PREMIUM_MAP[productId],
      });

      await Subscription.updateMany(
        { userId, isActive: true },
        { isActive: false }
      );

      await Subscription.create({
        userId,
        packageId: premiumPackage._id,
        startDate,
        endDate,
        isActive: true,
      });

      await User.findByIdAndUpdate(userId, {
        plan: PREMIUM_MAP[productId],
        planExpiresAt: endDate,
      });

      await Notification.create({
        user: userId,
        title: "Premium Aktif",
        message: `Premium üyeliğiniz aktif. Bitiş: ${endDate.toLocaleDateString(
          "tr-TR"
        )}`,
      });

      return res.json({
        ok: true,
        type: "subscription",
        plan: PREMIUM_MAP[productId],
        endDate,
      });
    }

    /* ================= BOOST ================= */

    if (BOOST_MAP[productId]) {
      if (!listingId) {
        return res.status(400).json({ message: "listingId zorunlu" });
      }

      // 🔒 DUPLICATE KORUMA
      const alreadyUsed = await ListingBoost.findOne({
        productId,
        transactionId,
      });

      if (alreadyUsed) {
        return res.json({
          ok: true,
          duplicate: true,
          message: "Boost daha önce uygulanmış",
        });
      }

      const days = BOOST_MAP[productId];

      const listing = await Listing.findById(listingId);
      if (!listing) {
        return res.status(404).json({ message: "İlan bulunamadı" });
      }

      if (String(listing.seller) !== String(userId)) {
        return res.status(403).json({ message: "Bu ilana boost atamazsın" });
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + days * 86400000);

      await ListingBoost.updateMany(
        { listingId, isActive: true },
        { isActive: false }
      );

      await ListingBoost.create({
        listingId,
        sellerId: userId,
        startDate: now,
        endDate,
        isActive: true,
        source: "iap",
        productId,
        transactionId,
      });

      listing.isBoosted = true;
      listing.boostExpiresAt = endDate;
      await listing.save();

      await Notification.create({
        user: userId,
        title: "İlan Öne Çıkarıldı",
        message: `İlanınız ${days} gün öne çıkarıldı.`,
      });

      return res.json({
        ok: true,
        type: "boost",
        listingId,
        endDate,
      });
    }

    return res.status(400).json({ message: "Geçersiz productId" });
  } catch (err) {
    console.error("IAP VERIFY ERROR:", err);
    return res.status(500).json({ message: "IAP doğrulama hatası" });
  }
};

/* ================= SUBSCRIPTION STATUS ================= */

export const getMySubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Yetkisiz" });
    }

    const user = await User.findById(userId).select("plan planExpiresAt");

    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    const now = new Date();
    const isPremium =
      user.plan !== "free" && user.planExpiresAt && user.planExpiresAt > now;

    return res.json({
      isPremium,
      plan: isPremium ? user.plan : "free",
      planExpiresAt: isPremium ? user.planExpiresAt : null,
    });
  } catch (err) {
    console.error("GET SUBSCRIPTION STATUS ERROR:", err);
    return res.status(500).json({ message: "Subscription durumu alınamadı" });
  }
};
