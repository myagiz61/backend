import ListingBoost from "../models/ListingBoost.js";
import Listing from "../models/Listing.js";

export const deactivateExpiredBoosts = async () => {
  try {
    const now = new Date();

    const expiredBoosts = await ListingBoost.find({
      isActive: true,
      endDate: { $lte: now },
    });

    if (expiredBoosts.length === 0) {
      return;
    }

    for (const boost of expiredBoosts) {
      // 1️⃣ Boost pasif
      boost.isActive = false;
      await boost.save();

      // 2️⃣ Listing flag temizle
      await Listing.findByIdAndUpdate(boost.listingId, {
        isBoosted: false,
        boostExpiresAt: null,
      });
    }

    console.log(`⏱️ ${expiredBoosts.length} boost süresi doldu, kapatıldı`);
  } catch (err) {
    console.error("❌ deactivateExpiredBoosts ERROR:", err);
  }
};
