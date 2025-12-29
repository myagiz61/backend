import nodemailer from "nodemailer";

export const sendMail = async ({ to, subject, text, html }) => {
  if (!process.env.SUPPORT_MAIL || !process.env.SUPPORT_PASS) {
    throw new Error("Mail credentials missing");
  }

  // 🔥 TRANSPORTER BURADA OLUŞUYOR
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SUPPORT_MAIL,
      pass: process.env.SUPPORT_PASS,
    },
  });

  return transporter.sendMail({
    from: `"TRPHONE Destek" <${process.env.SUPPORT_MAIL}>`,
    to,
    subject,
    text,
    html,
  });
};
