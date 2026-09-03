// Vercel Serverless Function: receives the LP contact form and sends it via Resend.
// Required environment variables (set in Vercel Project Settings -> Environment Variables):
//   RESEND_API_KEY     - your Resend API key (secret)
//   CONTACT_TO_EMAIL    - destination inbox, e.g. whitephat7@gmail.com
//   CONTACT_FROM_EMAIL  - optional. Must be an address on a domain verified in Resend.
//                         Falls back to Resend's shared test sender if not set.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripNewlines(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const TO_EMAIL = process.env.CONTACT_TO_EMAIL;
  const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev';

  if (!RESEND_API_KEY || !TO_EMAIL) {
    console.error('Missing RESEND_API_KEY or CONTACT_TO_EMAIL environment variable.');
    res.status(500).json({ error: 'サーバー設定が未完了です。しばらくしてから再度お試しください。' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { company, name, email, message } = body || {};

  if (!company || !name || !email || !message) {
    res.status(400).json({ error: '必須項目が未入力です。' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'メールアドレスの形式が正しくありません。' });
    return;
  }

  const safeCompany = stripNewlines(company).slice(0, 200);
  const safeName = stripNewlines(name).slice(0, 200);
  const safeEmail = stripNewlines(email).slice(0, 200);
  const safeMessage = String(message).slice(0, 5000);

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `WHITE Phat Graphics LP <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        reply_to: safeEmail,
        subject: `【無料デザイン診断】${safeCompany} 様よりお問い合わせ`,
        text:
          `会社名: ${safeCompany}\n` +
          `ご担当者様氏名: ${safeName}\n` +
          `メールアドレス: ${safeEmail}\n\n` +
          `現在のお悩み・ご要望:\n${safeMessage}`,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend API error:', resendRes.status, errText);
      res.status(502).json({ error: 'メール送信に失敗しました。時間をおいて再度お試しください。' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form handler error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました。時間をおいて再度お試しください。' });
  }
};
