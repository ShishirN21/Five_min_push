'use strict';
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { ciphers: 'SSLv3' },
});

const FROM = `Five Minute Push <${process.env.SMTP_USER}>`;
const NOTIFY_TO = 'info@fiveminutepush.com';

/* Notification email → info@fiveminutepush.com */
async function sendLeadNotification({ firstName, lastName, clinicName, phone, email, q1, q2, q3, q4 }) {
  await transporter.sendMail({
    from: FROM,
    to: NOTIFY_TO,
    subject: `New Survey Submission: ${firstName} ${lastName} — ${clinicName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;padding:32px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#006b9c;margin-bottom:4px;">🎁 New Free Vial Claim</h2>
        <p style="color:#666;margin-top:0;font-size:14px;">Survey submitted on fiveminutepush.com</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />

        <h3 style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Contact Details</h3>
        <table style="width:100%;font-size:15px;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:7px 0;color:#888;width:130px;">Name</td><td style="padding:7px 0;font-weight:600;">${firstName} ${lastName}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">Clinic</td><td style="padding:7px 0;font-weight:600;">${clinicName}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">Phone</td><td style="padding:7px 0;"><a href="tel:${phone}" style="color:#006b9c;">${phone}</a></td></tr>
          <tr><td style="padding:7px 0;color:#888;">Email</td><td style="padding:7px 0;"><a href="mailto:${email}" style="color:#006b9c;">${email}</a></td></tr>
        </table>

        <h3 style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Survey Answers</h3>
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr style="background:#f7f7f7;"><td style="padding:10px 12px;color:#555;border-radius:4px;">How long did it take?</td><td style="padding:10px 12px;font-weight:600;">${q1 || '—'}</td></tr>
          <tr><td style="padding:10px 12px;color:#555;">Were clients excited?</td><td style="padding:10px 12px;font-weight:600;">${q2 || '—'}</td></tr>
          <tr style="background:#f7f7f7;"><td style="padding:10px 12px;color:#555;border-radius:4px;">Was it easy to use?</td><td style="padding:10px 12px;font-weight:600;">${q3 || '—'}</td></tr>
          <tr><td style="padding:10px 12px;color:#555;">Would you offer it in future?</td><td style="padding:10px 12px;font-weight:600;">${q4 || '—'}</td></tr>
        </table>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:13px;color:#aaa;">Reply directly to this email to reach the lead.</p>
      </div>
    `,
    replyTo: email,
  });
}

/* Confirmation email → client */
async function sendClientConfirmation({ firstName, email }) {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'We received your inquiry — Five Minute Push',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#006b9c;">Hi ${firstName},</h2>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          Thanks for your interest in adding <strong>Five Minute Push</strong> to your clinic.
          We've received your details and a member of our team will be in touch within 1–2 business days.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          In the meantime, feel free to reply to this email with any questions.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:13px;color:#aaa;">
          Five Minute Push · <a href="https://fiveminutepush.com" style="color:#006b9c;">fiveminutepush.com</a>
        </p>
      </div>
    `,
  });
}

module.exports = { sendLeadNotification, sendClientConfirmation };
