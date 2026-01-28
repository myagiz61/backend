// src/routes/listingRoutes.js
import express from "express";
import Listing from "../models/Listing.js";
import { uploadListingImages } from "../middleware/uploadListingImages.js";
import { protect } from "../middleware/authMiddleware.js";
import { getListingById } from "../controllers/listingController.js";
import { checkSellerPlan } from "../middleware/checkSellerPlan.js";

const router = express.Router();

/* ===============================
   1) TÜM İLANLAR (PUBLIC)
================================ */
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find({
      status: "ACTIVE",
    })
      .sort({
        isBoosted: -1, // 🔥 Boost'lular en üste
        boostExpiresAt: -1, // 🔥 Uzun boost daha yukarı
        createdAt: -1, // 🕒 Son eklenen
      })
      .populate("seller", "storeName isPremium avatar");

    res.json(listings);
  } catch (err) {
    console.error("GET /listings hata:", err);
    res.status(500).json({ message: "İlanlar getirilemedi." });
  }
});

/* ===============================
   2) KENDİ İLANLARIM
================================ */
router.get("/my", protect, async (req, res) => {
  try {
    const listings = await Listing.find({ seller: req.user._id })
      .sort({
        createdAt: -1,
      })
      .populate("seller", "storeName isPremium avatar");

    res.json(listings);
  } catch (err) {
    console.log("MY LISTINGS ERROR:", err);
    res.status(500).json({ message: "İlanlar getirilemedi" });
  }
});

/* ===============================
   3) YENİ İLAN OLUŞTURMA
================================ */
router.post(
  "/",
  protect,
  checkSellerPlan,
  (req, res, next) => {
    uploadListingImages(req, res, (err) => {
      if (err) {
        return res
          .status(400)
          .json({ message: err.message || "Upload hatası" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      // 🔥 30 GÜN SÜRE
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const listing = await Listing.create({
        ...req.body,
        images: (req.files || []).map(
          (file) => `/uploads/listings/${file.filename}`
        ),
        seller: req.user._id,
        status: "ACTIVE",
        expiresAt, // 🔴 KRİTİK SATIR
      });

      const populatedListing = await listing.populate(
        "seller",
        "storeName isPremium avatar"
      );

      res.status(201).json(populatedListing);
    } catch (err) {
      console.error("İlan oluşturma hatası:", err);
      res.status(500).json({ message: "Sunucu hatası." });
    }
  }
);

router.get("/can-create", protect, checkSellerPlan, (req, res) => {
  return res.json({
    canCreate: true,
  });
});

/* ===============================
   4) İLAN GÜNCELLEME
================================ */
router.put("/:id", protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) return res.status(404).json({ message: "İlan bulunamadı" });

    if (listing.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Bu ilana erişimin yok" });

    Object.assign(listing, req.body);
    await listing.save();
    const populatedListing = await listing.populate(
      "seller",
      "storeName isPremium avatar"
    );
    res.json(populatedListing);
  } catch (err) {
    console.log("UPDATE LISTING ERROR:", err);
    res.status(500).json({ message: "İlan güncellenemedi" });
  }
});

/* ===============================
   5) İLAN SİLME
================================ */
router.delete("/:id", protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) return res.status(404).json({ message: "İlan bulunamadı" });

    if (listing.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Yetkin yok" });

    await listing.deleteOne();
    res.json({ message: "İlan silindi" });
  } catch (err) {
    console.log("DELETE LISTING ERROR:", err);
    res.status(500).json({ message: "İlan silinemedi" });
  }
});

/* ===============================
   6) TEK İLAN DETAYI
================================ */
router.get("/detail/:id", getListingById);

export default router;
