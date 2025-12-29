// controllers/chatController.js
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import Listing from "../models/Listing.js";
import { io } from "../server.js";

// SOHBET BAŞLAT veya VARSA GETİR
export const startOrGetChat = async (req, res) => {
  try {
    const { listingId } = req.body;
    const buyerId = req.user._id;

    if (!listingId) {
      return res.status(400).json({ message: "listingId gerekli" });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "İlan bulunamadı" });
    }

    const sellerId = listing.seller;
    const storeName = listing.storeName || "Mağaza";

    let chat = await Chat.findOne({
      listing: listingId,
      $or: [{ buyers: buyerId }, { buyer: buyerId }],
    });

    if (!chat) {
      chat = await Chat.create({
        seller: sellerId,
        listing: listingId,
        buyers: [buyerId],
        storeName,
      });
    } else if (!chat.storeName) {
      chat.storeName = storeName;
      await chat.save();
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: "Sohbet başlatılamadı" });
  }
};

// BUYER CHAT LIST
export const getBuyerChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      buyers: req.user._id,
    }).sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: "Sohbetler alınamadı" });
  }
};

// SELLER CHAT LIST
export const getSellerChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      seller: req.user._id,
    })
      .populate("buyers", "name")
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: "Satıcı sohbetleri alınamadı" });
  }
};

// CHAT DETAY (SELLER için ÖNEMLİ)
export const getChatDetail = async (req, res) => {
  try {
    const chatId = req.params.chatId;

    const chat = await Chat.findById(chatId)
      .populate("listing")
      .populate("buyers", "name")
      .populate("seller", "name");

    if (!chat) {
      return res.status(404).json({ message: "Chat bulunamadı" });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: "Chat detail alınamadı" });
  }
};

// CHAT MESSAGES
export const getMessages = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.user._id;

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { chat: chatId, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } }
    );

    const chat = await Chat.findById(chatId);
    if (chat) {
      const isBuyer = chat.buyers.some(
        (b) => b.toString() === userId.toString()
      );
      if (isBuyer) chat.buyerUnreadCount = 0;
      else chat.sellerUnreadCount = 0;
      await chat.save();
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Mesajlar alınamadı" });
  }
};

// SEND MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user._id;
    const chatId = req.params.chatId;

    let message = await Message.create({
      chat: chatId,
      sender: userId,
      text,
      seenBy: [userId],
    });

    message = await message.populate("sender", "name");

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat bulunamadı" });
    }

    const isBuyer = chat.buyers.some((b) => b.toString() === userId.toString());

    const update = {
      lastMessage: text,
      updatedAt: new Date(),
    };

    if (isBuyer) update.sellerUnreadCount = (chat.sellerUnreadCount || 0) + 1;
    else update.buyerUnreadCount = (chat.buyerUnreadCount || 0) + 1;

    await Chat.findByIdAndUpdate(chatId, update);

    io.to(chatId.toString()).emit("newMessage", {
      ...message.toObject(),
      chat: chatId,
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: "Mesaj gönderilemedi" });
  }
};

// SELLER READ
export const markSellerRead = async (req, res) => {
  try {
    const chatId = req.params.chatId;

    await Message.updateMany(
      { chat: chatId },
      { $addToSet: { seenBy: req.user._id } }
    );

    await Chat.findByIdAndUpdate(chatId, { sellerUnreadCount: 0 });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Satıcı okundu hatası" });
  }
};

// SELLER ALL MESSAGES
export const getSellerMessages = async (req, res) => {
  try {
    const sellerId = req.user._id;

    const chats = await Chat.find({ seller: sellerId }).select("_id");
    const chatIds = chats.map((c) => c._id);

    if (chatIds.length === 0) return res.json([]);

    const messages = await Message.find({ chat: { $in: chatIds } })
      .populate("sender", "name")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Satıcı mesajları alınamadı" });
  }
};
