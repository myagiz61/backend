import Message from "./models/Message.js";
import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

// DB
import { connectDB } from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// Middleware
import { protect } from "./middleware/authMiddleware.js";
import { verifyAdmin } from "./middleware/verifyAdmin.js";

// Jobs
import { startBoostWatcher } from "./jobs/boostJobs.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

/* =========================
   DATABASE
========================= */
await connectDB();
startBoostWatcher();

/* =========================
   SOCKET.IO SETUP
========================= */
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 🔐 SOCKET AUTH (JWT)
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { _id, role }

    socket.userId = decoded._id; // ✅ DÜZELTİLDİ
    socket.role = decoded.role;

    next();
  } catch (err) {
    console.log("Socket Auth Error:", err.message);
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log(
    "📡 Yeni socket bağlantısı:",
    socket.id,
    "→ USER:",
    socket.userId,
    "ROLE:",
    socket.role
  );

  socket.on("joinRoom", (chatId) => {
    socket.join(chatId);
    console.log(`👥 Kullanıcı (${socket.userId}) odaya katıldı: ${chatId}`);
  });

  socket.on("seenMessages", async ({ chatId }) => {
    try {
      await Message.updateMany(
        { chat: chatId, seenBy: { $ne: socket.userId } },
        { $addToSet: { seenBy: socket.userId } }
      );

      io.to(chatId).emit("messagesSeen", {
        chatId,
        userId: socket.userId,
      });
    } catch (err) {
      console.log("Seen error:", err.message);
    }
  });

  socket.on("sendMessage", (data) => {
    const { chatId, _id, text, sender, createdAt } = data;
    if (!chatId) return;

    io.to(chatId).emit("newMessage", {
      _id,
      chat: chatId,
      text,
      sender,
      createdAt,
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket kapandı:", socket.id);
  });
});

// ✔ Socket export
export { io };

/* =========================
   EXPRESS MIDDLEWARES
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   STATICS
========================= */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* =========================
   TEST ROUTES
========================= */
app.get("/", (req, res) => {
  res.json({ message: "TRPHONE Backend Çalışıyor 🚀" });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

/* =========================
   API ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/payments", paymentRoutes);

// 🔒 ADMIN
app.use("/api/admin", protect, verifyAdmin, adminRoutes);

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 1967;

server.listen(PORT, () => {
  console.log(`🚀 TRPHONE Backend ${PORT} portunda çalışıyor`);
  console.log("📡 Socket.io aktif!");
});
