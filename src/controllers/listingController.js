import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js"; // 🔥 EKSİK OLAN EKLENDİ
import ListingBoost from "../models/ListingBoost.js";

export const activateListingBoost = async ({
  listingId,
  sellerId,
  boostType,
}) => {
  const listing = await Listing.findById(listingId);

  if (!listing) {
    throw new Error("İlan bulunamadı");
  }

  if (listing.seller.toString() !== sellerId.toString()) {
    throw new Error("Yetkisiz boost denemesi");
  }

  /* ===============================
     BOOST SÜRELERİ
  ================================ */
  const BOOST_DURATIONS = {
    DAY_1: 1,
    WEEK_1: 7,
    MONTH_1: 30,
  };

  const days = BOOST_DURATIONS[boostType];
  if (!days) {
    throw new Error("Geçersiz boost tipi");
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  /* ===============================
     1️⃣ OVERLAP KAPAT (KRİTİK)
  ================================ */
  await ListingBoost.updateMany(
    {
      listingId,
      isActive: true,
    },
    {
      isActive: false,
    }
  );

  /* ===============================
     2️⃣ YENİ BOOST OLUŞTUR
  ================================ */
  await ListingBoost.create({
    listingId,
    sellerId,
    boostType,
    startDate: now,
    endDate,
    isActive: true,
  });

  /* ===============================
     3️⃣ LISTING FLAG GÜNCELLE
  ================================ */
  listing.isBoosted = true;
  listing.boostExpiresAt = endDate;
  await listing.save();

  /* ===============================
     4️⃣ BİLDİRİM
  ================================ */
  await Notification.create({
    user: sellerId,
    title: "Boost Aktif!",
    message: `${listing.title} ilanınız ${days} gün boyunca öne çıkarıldı.`,
  });

  return {
    listingId,
    boostType,
    startDate: now,
    endDate,
  };
};

// 🔥 Tek ilan getir
export const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate("seller", "storeName isPremium avatar")
      .populate("seller", "storeName isPremium avatar phone address");

    if (!listing) {
      return res.status(404).json({ message: "İlan bulunamadı" });
    }

    if (
      listing.isBoosted &&
      listing.boostExpiresAt &&
      listing.boostExpiresAt < new Date()
    ) {
      listing.isBoosted = false;
      listing.boostExpiresAt = null;
      await listing.save();
    }

    res.json(listing);
  } catch (err) {
    console.error("getListingById ERROR:", err);
    res.status(500).json({ message: "İlan bilgisi alınamadı" });
  }
};
