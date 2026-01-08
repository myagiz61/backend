import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Listing from "../models/Listing.js";
import { SELLER_PLANS } from "../config/plans.js";

export const checkSellerPlan = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    /* ===============================
       1️⃣ USER KONTROLÜ
    ================================ */
    const user = await User.findById(userId);
    if (!user || user.role !== "seller") {
      return res.status(403).json({
        message: "Satıcı hesabı bulunamadı.",
        code: "SELLER_REQUIRED",
      });
    }

    /* ===============================
       2️⃣ AKTİF SUBSCRIPTION (ZORUNLU)
    ================================ */
    const subscription = await Subscription.findOne({
      userId,
      isActive: true,
      endDate: { $gt: new Date() },
    }).populate("packageId");

    // 🔴 Subscription yoksa HİÇBİR PLAN YOK
    if (!subscription) {
      return res.status(403).json({
        message: "İlan eklemek için bir premium paket satın almalısınız.",
        code: "PLAN_REQUIRED",
      });
    }

    /* ===============================
       3️⃣ PLAN BELİRLEME + CACHE SENKRON
    ================================ */
    const planName = subscription.packageId?.name;
    const planExpiresAt = subscription.endDate;

    if (!planName) {
      return res.status(403).json({
        message: "Geçersiz paket bilgisi.",
        code: "INVALID_PLAN",
      });
    }

    // Cache senkron (User tablosu)
    if (
      user.plan !== planName ||
      user.planExpiresAt?.getTime() !== planExpiresAt?.getTime()
    ) {
      user.plan = planName;
      user.planExpiresAt = planExpiresAt;
      await user.save();
    }

    /* ===============================
       4️⃣ PLAN CONFIG KONTROLÜ
    ================================ */
    const planConfig = SELLER_PLANS[planName];
    if (!planConfig) {
      return res.status(403).json({
        message: "Geçersiz plan.",
        code: "INVALID_PLAN",
      });
    }

    /* ===============================
       5️⃣ AKTİF İLAN LİMİTİ KONTROLÜ
    ================================ */
    const activeListingCount = await Listing.countDocuments({
      seller: userId,
      status: "ACTIVE",
    });

    if (
      planConfig.maxListings !== Infinity &&
      activeListingCount >= planConfig.maxListings
    ) {
      return res.status(403).json({
        message: `Plan limitine ulaştınız. (${planConfig.maxListings} ilan sınırı)`,
        code: "PLAN_LIMIT_REACHED",
      });
    }

    /* ===============================
       6️⃣ HER ŞEY TAMAM
    ================================ */
    next();
  } catch (err) {
    console.error("checkSellerPlan ERROR:", err);
    return res.status(500).json({
      message: "Sunucu hatası.",
      code: "SERVER_ERROR",
    });
  }
};
