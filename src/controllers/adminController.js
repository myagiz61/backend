import User from "../models/User.js";
import fs from "fs";
import path from "path";

export const rejectSellerAndDelete = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { reason } = req.body;

    const seller = await User.findById(sellerId);

    if (!seller) {
      return res.status(404).json({ message: "Satıcı bulunamadı." });
    }

    if (seller.role !== "seller") {
      return res.status(400).json({ message: "Bu kullanıcı satıcı değil." });
    }

    if (seller.sellerStatus !== "pending") {
      return res
        .status(400)
        .json({ message: "Sadece bekleyen satıcılar reddedilebilir." });
    }

    // 📂 Vergi PDF dosyasını sil
    if (seller.taxDocument) {
      const filePath = path.resolve(seller.taxDocument);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 🗑 USER KAYDINI TAMAMEN SİL
    await User.deleteOne({ _id: sellerId });

    // 🧾 Admin log (şiddetle önerilir)
    await AdminLog.create({
      action: "SELLER_REJECTED",
      message: `Satıcı reddedildi ve silindi: ${seller.email} | Sebep: ${reason}`,
      adminId: req.user._id,
    });

    return res.json({
      message: "Satıcı reddedildi ve sistemden tamamen silindi.",
    });
  } catch (err) {
    console.error("rejectSellerAndDelete error:", err);
    res.status(500).json({ message: "Satıcı reddedilirken hata oluştu." });
  }
};
