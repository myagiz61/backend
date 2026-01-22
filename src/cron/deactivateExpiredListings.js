import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";

export const deactivateExpiredListings = async () => {
  try {
    const now = new Date();

    const expiredListings = await Listing.find({
      status: "ACTIVE",
      expiresAt: { $lte: now },
    });

    for (const listing of expiredListings) {
      listing.status = "PASSIVE";
      await listing.save();

      await Notification.create({
        user: listing.seller,
        title: "İlan Süresi Doldu",
        message: `${listing.title} ilanınızın süresi dolduğu için pasife alındı.`,
      });

      console.log(`⛔ İLAN PASİF → ${listing._id} (expiresAt doldu)`);
    }
  } catch (err) {
    console.error("EXPIRED LISTING CRON ERROR:", err);
  }
};
