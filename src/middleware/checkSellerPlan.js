import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Listing from "../models/Listing.js";
import { SELLER_PLANS } from "../config/plans.js";

export const checkSellerPlan = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Kullanıcı
    const user = await User.findById(userId);
    if (!user || user.role !== "seller") {
      return res.status(403).json({ message: "Satıcı hesabı bulunamadı." });
    }

    // 2️⃣ Aktif subscription (GERÇEK KAYIT)
    const subscription = await Subscription.findOne({
      userId,
      isActive: true,
      endDate: { $gt: new Date() },
    }).populate("packageId");

    // 3️⃣ Plan adı (subscription varsa oradan, yoksa basic)
    let planName = "basic";

    if (subscription) {
      planName = subscription.packageId.name;

      // 🔄 Cache senkron (opsiyonel ama önerilir)
      if (user.plan !== planName) {
        user.plan = planName;
        user.planExpiresAt = subscription.endDate;
        await user.save();
      }
    } else {
      // Subscription yok ama user.plan premium görünüyorsa → düşür
      if (user.plan !== "basic") {
        user.plan = "basic";
        user.planExpiresAt = null;
        await user.save();
      }
    }

    // 4️⃣ Plan config
    const planConfig = SELLER_PLANS[planName];
    if (!planConfig) {
      return res.status(403).json({ message: "Geçersiz plan." });
    }

    // 5️⃣ Aktif ilan sayısı
    const activeListingCount = await Listing.countDocuments({
      seller: userId,
      status: "ACTIVE",
    });

    if (activeListingCount >= planConfig.maxListings) {
      return res.status(403).json({
        message: `Plan limitine ulaştınız. (${planConfig.maxListings} ilan sınırı)`,
        code: "PLAN_LIMIT_REACHED",
      });
    }

    // 6️⃣ Her şey tamam
    next();
  } catch (err) {
    console.error("checkSellerPlan ERROR:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};
