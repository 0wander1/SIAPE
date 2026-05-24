const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

async function sendVerificationCode(correo, codigo) {
  try {
    await transporter.sendMail({
      from: `"SIAPE" <${process.env.GMAIL_USER}>`,
      to: correo,
      subject: 'Código de verificación SIAPE',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="margin:0 0 16px;color:#111827">Código de verificación</h2>
          <p style="margin:0 0 24px;color:#6b7280">Usa el siguiente código para continuar. Expira en 10 minutos.</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;text-align:center;padding:16px;background:#f3f4f6;border-radius:6px">
            ${codigo}
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Si no solicitaste este código, ignora este mensaje.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error nodemailer:', error);
    throw error;
  }
}

module.exports = { sendVerificationCode };
