import "dotenv/config"; // 👈 EN KRİTİK SATIR (mutlaka en üstte)
// server.js
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

// DB
import { connectDB } from "./config/db.js";

// Models
import Message from "./models/Message.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";

// Middleware
import { protect } from "./middleware/authMiddleware.js";
import { verifyAdmin } from "./middleware/verifyAdmin.js";

// Jobs
import { startBoostWatcher } from "./jobs/boostJobs.js";

const app = express();
const server = http.createServer(app);

/* =========================
   DATABASE & JOBS
========================= */
await connectDB();
startBoostWatcher();

/* =========================
   CORS (COOKIE + MOBIL UYUMLU)
========================= */
const ALLOWED_ORIGINS = [
  "http://localhost:1967",
  "http://10.0.2.2:3000",
  "https://trphone.net",
  "https://www.trphone.net",
];

app.use(
  cors({
    origin: "*",
  })
);

/* =========================
   BODY PARSER
========================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATICS
========================= */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* =========================
   SOCKET.IO
========================= */
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

// Socket JWT Auth
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded._id;
    socket.role = decoded.role;
    next();
  } catch (err) {
    console.log("Socket Auth Error:", err.message);
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log(
    "📡 Socket bağlandı:",
    socket.id,
    "USER:",
    socket.userId,
    "ROLE:",
    socket.role
  );

  socket.on("joinRoom", (chatId) => {
    if (!chatId) return;
    socket.join(chatId);
    console.log(`👥 ${socket.userId} odaya girdi: ${chatId}`);
  });

  socket.on("seenMessages", async ({ chatId }) => {
    if (!chatId) return;
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
    const { chatId, _id, text, sender, createdAt } = data || {};
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

// Socket export (controller’lardan emit için)
export { io };

/* =========================
   HEALTH / ROOT
========================= */
app.get("/", (req, res) => {
  res.json({ message: "TRPHONE Backend Çalışıyor 🚀" });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    env: process.env.NODE_ENV,
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
app.use("/api/admin", protect, verifyAdmin, adminRoutes);
app.use("/api/packages", packageRoutes);

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 TRPHONE Backend ${PORT} portunda çalışıyor`);
  console.log("📡 Socket.io aktif!");
});
