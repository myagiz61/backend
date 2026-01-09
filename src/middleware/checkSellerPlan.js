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
       2️⃣ AKTİF SUBSCRIPTION
    ================================ */
    const subscription = await Subscription.findOne({
      userId,
      isActive: true,
      endDate: { $gt: new Date() },
    }).populate("packageId");

    if (!subscription || !subscription.packageId) {
      return res.status(403).json({
        message: "İlan eklemek için bir paket satın almalısınız.",
        code: "PLAN_REQUIRED",
      });
    }

    /* ===============================
       3️⃣ PLAN KEY NORMALİZASYONU
    ================================ */
    const rawKey =
      subscription.packageId.key || subscription.packageId.name || "";

    const normalized = rawKey.toString().toLowerCase();

    let planKey = null;

    if (normalized.includes("basic")) planKey = "basic";
    else if (
      normalized.includes("standard") ||
      normalized.includes("standart") ||
      normalized.includes("orta")
    )
      planKey = "standard";
    else if (normalized.includes("pro")) planKey = "pro";

    if (!planKey) {
      return res.status(403).json({
        message: "Geçersiz paket bilgisi.",
        code: "INVALID_PLAN",
      });
    }

    const planExpiresAt = subscription.endDate;

    /* ===============================
       4️⃣ USER CACHE SENKRON
    ================================ */
    if (
      user.plan !== planKey ||
      user.planExpiresAt?.getTime() !== planExpiresAt?.getTime()
    ) {
      user.plan = planKey;
      user.planExpiresAt = planExpiresAt;
      await user.save();
    }

    /* ===============================
       5️⃣ PLAN CONFIG
    ================================ */
    const planConfig = SELLER_PLANS[planKey];

    if (!planConfig) {
      return res.status(403).json({
        message: "Geçersiz plan.",
        code: "INVALID_PLAN",
      });
    }

    /* ===============================
       6️⃣ İLAN SAYISI KONTROLÜ
    ================================ */
    const listingCount = await Listing.countDocuments({
      seller: userId,
    });

    if (
      planConfig.maxListings !== Infinity &&
      listingCount >= planConfig.maxListings
    ) {
      return res.status(403).json({
        message: `Plan limitine ulaştınız. (${planConfig.maxListings} ilan sınırı)`,
        code: "PLAN_LIMIT_REACHED",
      });
    }

    /* ===============================
       7️⃣ OK
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
