import Notification from "../models/Notification.js";
import Listing from "../models/Listing.js";

export const startBoostWatcher = () => {
  console.log("⏱️ Boost watcher çalışıyor...");

  setInterval(async () => {
    try {
      const now = new Date();

      // Süresi dolan boost'ları al
      const expiredBoosts = await Listing.find({
        isBoosted: true,
        boostExpiresAt: { $lte: now },
      });

      for (let listing of expiredBoosts) {
        // Boost'u kapat
        listing.isBoosted = false;
        listing.boostExpiresAt = null;
        await listing.save();

        // Bildirim kaydet
        await Notification.create({
          user: listing.seller,
          title: "Boost Süresi Bitti",
          message: `${listing.title} ilanının boost süresi sona erdi.`,
        });

        console.log(
          `🔔 BOOST BİTTİ → Bildirim oluşturuldu → ilan=${listing._id}`
        );
      }
    } catch (err) {
      console.error("BOOST WATCHER ERROR:", err);
    }
  }, 60 * 1000); // 1 dakika (test için)
};
