import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY missing");
  }

  return await resend.emails.send({
    from: process.env.MAIL_FROM, // TRPHONE <noreply@myssoftwares.com>
    to,
    subject,
    text,
    html,
  });
};
