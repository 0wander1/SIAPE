// Servicio de envío de correos electrónicos transaccionales mediante Resend.
// Usa la API key de la variable de entorno RESEND_API_KEY.
// Este servicio solo envía correos; no almacena registros ni gestiona reintentos.
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Envía un correo HTML al destinatario indicado con el código de verificación de seis dígitos.
// Se usa durante el segundo paso del login (auth.controller → auth.service → aquí) para
// que el trabajador confirme su identidad antes de recibir el JWT.
//
// Parámetros:
//   correo — dirección de destino obtenida del registro del trabajador en la BD.
//   codigo — string de 6 dígitos generado por authService.generateCode().
//
// Comportamiento ante errores:
//   Si Resend devuelve un error, este servicio lo registra en consola y lo vuelve a lanzar
//   para que el llamador decida cómo manejarla. En auth.controller el error se captura
//   en silencio porque la respuesta HTTP ya fue enviada (patrón fire-and-forget);
//   de este modo el fallo de correo no afecta al usuario ni bloquea el proceso de login.
async function sendVerificationCode(correo, codigo) {
  try {
    const { error } = await resend.emails.send({
      from:    'noreply@siape.site',
      to:      correo,
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

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error Resend:', error);
    throw error;
  }
}

module.exports = { sendVerificationCode };
