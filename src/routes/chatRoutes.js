import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  startOrGetChat,
  getBuyerChats,
  getSellerChats,
  getSellerMessages,
  getMessages,
  sendMessage,
} from "../controllers/chatController.js";

import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

const router = express.Router();

/**
 * BUYER → Sohbet başlat
 */
router.post("/start-or-get", protect, startOrGetChat);

/**
 * BUYER → Sohbet listesi
 */
router.get("/", protect, getBuyerChats);

/**
 * SELLER → Sohbet listesi
 */
router.get("/seller/list", protect, getSellerChats);

/**
 * SELLER → Tüm mesajlar
 */
router.get("/seller/messages", protect, getSellerMessages);

/**
 * SELLER/BUYER → Chat detay getir
 * (seller header’da ilan & müşteri bilgisi için gerekli)
 */
router.get("/:chatId", protect, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .populate("listing")
      .populate("buyers", "name")
      .populate("seller", "name");

    if (!chat) {
      return res.status(404).json({ message: "Chat bulunamadı" });
    }

    res.json(chat);
  } catch (err) {
    console.log("CHAT DETAIL ERROR:", err);
    res.status(500).json({ message: "Chat detail alınamadı" });
  }
});

/**
 * SELLER → Okundu işaretleme
 */
router.post("/:chatId/mark-seller-read", protect, async (req, res) => {
  try {
    const chatId = req.params.chatId;

    await Message.updateMany(
      { chat: chatId, sellerSeen: false },
      { sellerSeen: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.log("MARK SELLER READ ERROR:", err);
    res.status(500).json({ message: "mark-seller-read hatası" });
  }
});

/**
 * Mesajları getir
 */
router.get("/:chatId/messages", protect, getMessages);

/**
 * Mesaj gönder
 */
router.post("/:chatId/messages", protect, sendMessage);

export default router;
