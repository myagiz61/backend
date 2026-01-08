import User from "../models/User.js";

export const saveFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token gerekli" });
    }

    await User.updateOne(
      { _id: req.user._id },
      { $set: { fcmToken } },
      {
        runValidators: false,
        upsert: false,
      }
    );
    console.log("FCM SAVE USER:", req.user._id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("🔥 FCM SAVE ERROR:", err);
    return res.status(500).json({ message: "FCM token kaydedilemedi" });
  }
};
