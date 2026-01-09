import express from "express";
import Package from "../models/Package.js";

const router = express.Router();

/**
 * MEMBERSHIP paketleri (basic / standard / pro)
 */
router.get("/memberships", async (req, res) => {
  try {
    const packages = await Package.find({
      name: { $in: ["basic", "standard", "pro"] },
      isActive: { $ne: false },
    }).select("name price durationDays");

    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: "Membership paketleri alınamadı" });
  }
});

/**
 * BOOST ürünleri
 */
router.get("/boosts", async (req, res) => {
  try {
    const packages = await Package.find({
      name: { $regex: /^boost_/ },
      isActive: { $ne: false },
    }).select("name price durationDays");

    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: "Boost paketleri alınamadı" });
  }
});

export default router;
