import admin from "../config/firebase.js";
import User from "../models/User.js";

export const sendPushNotification = async ({
  userId,
  title,
  body,
  data = {},
}) => {
  try {
    const user = await User.findById(userId);
    if (!user?.fcmToken) return;

    await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK", // Android için safe
      },
    });
  } catch (err) {
    console.error("FCM SEND ERROR:", err.message);
  }
};
