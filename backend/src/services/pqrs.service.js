const nodemailer = require('nodemailer');

async function send({ tipo, asunto, descripcion, remitente }) {
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

  try {
    await transporter.sendMail({
      from: `"SIAPE" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `[PQRS SIAPE] ${tipo} - ${asunto}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="margin:0 0 24px;color:#111827">Nueva PQRS recibida</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151;width:120px;border-radius:4px 0 0 4px">Tipo</td>
              <td style="padding:10px 12px;color:#111827">${tipo}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151">Asunto</td>
              <td style="padding:10px 12px;color:#111827">${asunto}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151">Remitente</td>
              <td style="padding:10px 12px;color:#111827">${remitente}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151;vertical-align:top">Descripción</td>
              <td style="padding:10px 12px;color:#111827;white-space:pre-wrap">${descripcion}</td>
            </tr>
          </table>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error nodemailer (PQRS):', error);
    throw error;
  }
}

module.exports = { send };
