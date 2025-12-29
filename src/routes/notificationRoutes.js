import express from "express";
import Notification from "../models/Notification.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Tüm bildirimler (sadece giriş yapan kişi için)
router.get("/", protect, async (req, res) => {
  try {
    const list = await Notification.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Bildirimler getirilemedi" });
  }
});

router.post("/test", protect, async (req, res) => {
  try {
    const note = await Notification.create({
      user: req.user._id, // 🔥 artık giriş yapan kimse, ona gider
      title: "Test Bildirimi",
      message: "Bu sadece sistem testi için oluşturulmuş bir bildirimdir.",
    });

    res.json(note);
  } catch (err) {
    res.status(500).json({ message: "Test bildirimi oluşturulamadı" });
  }
});

export default router;
