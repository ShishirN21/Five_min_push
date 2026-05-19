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
async function sendLeadNotification({ firstName, lastName, email }) {
  await transporter.sendMail({
    from: FROM,
    to: NOTIFY_TO,
    subject: `New Sign-Up: ${firstName} ${lastName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#006b9c;margin-bottom:4px;">New Clinic Sign-Up</h2>
        <p style="color:#666;margin-top:0;font-size:14px;">Someone just submitted the partnership form on fiveminutepush.com</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <table style="width:100%;font-size:15px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#888;width:120px;">First Name</td><td style="padding:8px 0;font-weight:600;">${firstName}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Last Name</td><td style="padding:8px 0;font-weight:600;">${lastName}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#006b9c;">${email}</a></td></tr>
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
