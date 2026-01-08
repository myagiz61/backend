import admin from "../config/firebase.js";

export const sendTestPush = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "FCM token gerekli" });
    }

    const message = {
      token,
      notification: {
        title: "🔥 Test Bildirimi",
        body: "Push notification çalışıyor!",
      },
      android: {
        priority: "high",
      },
    };

    const response = await admin.messaging().send(message);

    res.json({
      ok: true,
      firebaseResponse: response,
    });
  } catch (err) {
    console.error("Push error:", err);
    res.status(500).json({ message: "Push gönderilemedi" });
  }
};
