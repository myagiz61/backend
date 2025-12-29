import express from "express";
import SupportTicket from "../models/SupportTicket.js";
import { protect } from "../middleware/authMiddleware.js";
import nodemailer from "nodemailer";

const router = express.Router();

// ********************************************
//  DESTEK TALEBİ GÖNDERME (DB + EMAIL)
// ********************************************
router.post("/send", protect, async (req, res) => {
  console.log("📩 DESTEK ENDPOINT TETİKLENDİ"); // 🚀 1 - backend'e istek geliyor mu?

  try {
    const { subject, message } = req.body;

    console.log("📌 Gelen Data:", { subject, message }); // 🚀 2 - frontend doğru data yolluyor mu?
    console.log("👤 Kullanıcı:", req.user); // 🚀 3 - token doğru mu decode oluyor?

    if (!subject || !message) {
      console.log("⚠️ Eksik alan hatası");
      return res.status(400).json({ message: "Konu ve mesaj zorunludur." });
    }

    // 1️⃣ DB'ye kaydet
    const ticket = await SupportTicket.create({
      user: req.user._id,
      subject,
      message,
    });

    console.log("🗃️ Ticket DB'ye kaydedildi:", ticket._id); // 🚀 4 - veri DB'ye giriyor mu?

    // 2️⃣ SMTP – Gmail
    console.log("📨 Mail gönderimi başlıyor..."); // 🚀 5 - mail aşamasına geçti mi?

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SUPPORT_MAIL,
        pass: process.env.SUPPORT_PASS,
      },
    });

    // Transporter doğrulama logu
    transporter.verify((err, success) => {
      if (err) {
        console.log("❌ SMTP Bağlantı Hatası:", err);
      } else {
        console.log("✅ SMTP Bağlantısı başarılı");
      }
    });

    await transporter.sendMail({
      from: `"TRPHONE Destek" <${process.env.SUPPORT_MAIL}>`,
      to: process.env.SUPPORT_MAIL,
      subject: `Yeni Destek Talebi • ${subject}`,
      html: `
        <h2>Yeni Destek Talebi</h2>
        <p><b>Konu:</b> ${subject}</p>
        <p><b>Mesaj:</b> ${message}</p>
        <br />
        <p><b>Kullanıcı:</b> ${req.user.name}</p>
        <p><b>Telefon:</b> ${req.user.phone}</p>
        <p><b>Email:</b> ${req.user.email}</p>
        <br />
        <p><b>Gönderim Tarihi:</b> ${new Date().toLocaleString("tr-TR")}</p>
        <p><b>Ticket ID:</b> ${ticket._id}</p>
      `,
    });

    console.log("📧 Mail başarıyla gönderildi!"); // 🚀 6 - mail gönderildi mi?

    return res.json({
      success: true,
      message: "Destek talebiniz başarıyla iletildi.",
    });
  } catch (err) {
    console.log("❌ Support error (DETAYLI):", err); // 🚀 7 - hata tam olarak ne?
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
