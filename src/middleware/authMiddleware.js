// src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token yok" });
    }

    const token = authHeader.split(" ")[1];

    // TOKEN DECODE
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { _id, role }

    // KULLANICIYI DB'DEN ÇEK
    const user = await User.findById(decoded._id).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ message: "Kullanıcı bulunamadı" });
    }

    // REQUEST'E KOY
    req.user = user;
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Token geçersiz" });
  }
};

// 🔒 SADECE ADMIN
export const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Bu işlem için admin yetkisi gerekli" });
  }
  next();
};

// Sadece satıcı rolü (mağaza) için
export const sellerOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Yetkisiz istek." });
  }

  if (req.user.role !== "seller") {
    return res
      .status(403)
      .json({ message: "Bu işlem için satıcı (mağaza) hesabı gerekli." });
  }

  next();
};
