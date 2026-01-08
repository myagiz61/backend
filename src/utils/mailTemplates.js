export function buildNewMessageEmailTemplate({
  receiverName = "",
  senderRoleLabel = "Karşı taraf",
  messageText = "",
  chatUrl = "https://trphone.net", // isterseniz direkt "trphone://chat/..." da ekleriz
  brandName = "TrPhone",
  supportEmail = "destek@trphone.net",
}) {
  const safeName = receiverName?.trim() || "Merhaba";
  const safeMsg = (messageText || "").toString().slice(0, 1200);

  return `<!doctype html>
  <html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${brandName} - Yeni Mesaj</title>
    <style>
      /* Client reset */
      html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
      * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; border-collapse:collapse !important; }
      img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
      a { text-decoration:none; }
  
      /* Layout */
      .container { width:100%; background:#f4f6fb; padding:24px 0; }
      .card { width:100%; max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(16, 24, 40, 0.08); }
      .header { padding:22px 28px; background:linear-gradient(135deg,#0b1220,#111b33); color:#ffffff; }
      .brand { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; font-size:18px; font-weight:700; letter-spacing:0.2px; }
      .subtitle { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; font-size:13px; opacity:0.85; margin-top:6px; }
  
      .content { padding:26px 28px 14px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#101828; }
      .title { font-size:18px; font-weight:800; margin:0 0 10px; }
      .text { font-size:14px; line-height:1.6; margin:0 0 16px; color:#344054; }
  
      .meta { display:inline-block; font-size:12px; color:#667085; background:#f2f4f7; border:1px solid #eaecf0; padding:6px 10px; border-radius:999px; margin-bottom:14px; }
  
      .msgbox { background:#f9fafb; border:1px solid #eaecf0; border-radius:14px; padding:14px 14px; color:#101828; }
      .msglabel { font-size:12px; color:#667085; margin:0 0 6px; }
      .msgtext { font-size:14px; line-height:1.6; margin:0; white-space:pre-wrap; word-break:break-word; }
  
      .ctaWrap { padding:0 28px 24px; }
      .cta { display:inline-block; background:#2563eb; color:#ffffff !important; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
             font-size:14px; font-weight:700; padding:12px 16px; border-radius:12px; }
      .ctaNote { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; font-size:12px; color:#667085; margin-top:10px; }
  
      .footer { padding:18px 28px 24px; border-top:1px solid #eaecf0; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#667085; }
      .footRow { font-size:12px; line-height:1.6; }
      .link { color:#2563eb !important; text-decoration:underline; }
  
      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .container { background:#0b1220 !important; }
        .card { background:#0f172a !important; box-shadow:none !important; }
        .content { color:#e5e7eb !important; }
        .text { color:#cbd5e1 !important; }
        .meta { background:#0b1220 !important; border-color:#1f2937 !important; color:#94a3b8 !important; }
        .msgbox { background:#0b1220 !important; border-color:#1f2937 !important; }
        .msglabel { color:#94a3b8 !important; }
        .msgtext { color:#e5e7eb !important; }
        .footer { border-color:#1f2937 !important; color:#94a3b8 !important; }
        .cta { background:#3b82f6 !important; }
      }
  
      /* Mobile */
      @media screen and (max-width: 520px) {
        .header, .content, .ctaWrap, .footer { padding-left:18px !important; padding-right:18px !important; }
        .card { border-radius:14px !important; }
      }
    </style>
  </head>
  
  <body>
    <div class="container">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <div class="card">
              <div class="header">
                <div class="brand">${brandName}</div>
                <div class="subtitle">Yeni mesaj bildirimi</div>
              </div>
  
              <div class="content">
                <p class="title">${safeName}, yeni bir mesajınız var.</p>
  
                <div class="meta">${senderRoleLabel} tarafından gönderildi</div>
  
                <p class="text">
                  Mesajı uygulamadan görüntüleyip yanıtlayabilirsiniz.
                </p>
  
                <div class="msgbox">
                  <p class="msglabel">Mesaj içeriği</p>
                  <p class="msgtext">${escapeHtml(safeMsg)}</p>
                </div>
              </div>
  
              <div class="ctaWrap">
                <a class="cta" href="${chatUrl}" target="_blank" rel="noopener">Mesajı Görüntüle</a>
                <div class="ctaNote">
                  Buton çalışmazsa şu bağlantıyı kullanın:
                  <a class="link" href="${chatUrl}" target="_blank" rel="noopener">${chatUrl}</a>
                </div>
              </div>
  
              <div class="footer">
                <div class="footRow">
                  Bu e-posta otomatik olarak gönderilmiştir. Yanıtlamayın.
                </div>
                <div class="footRow">
                  Destek: <a class="link" href="mailto:${supportEmail}">${supportEmail}</a>
                </div>
                <div class="footRow">
                  © ${new Date().getFullYear()} ${brandName}
                </div>
              </div>
            </div>
  
            <div style="max-width:640px;margin:12px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#98a2b3;font-size:11px;line-height:1.5;padding:0 10px;">
              Güvenlik notu: Hesap bilgilerinizi isteyen şüpheli mesajlara itibar etmeyin.
            </div>
  
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>`;
}

// Basit HTML escape (XSS riskini azaltır)
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
