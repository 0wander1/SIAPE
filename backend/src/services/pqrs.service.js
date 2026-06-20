// Servicio de envío de correos para el módulo de PQRS (Peticiones, Quejas, Reclamos y Sugerencias).
// Utiliza nodemailer con Gmail SMTP (misma configuración STARTTLS que email.service.js)
// para notificar al administrador del negocio cada vez que un trabajador envía una PQRS.
// Este servicio solo despacha el correo; no persiste registros en la BD ni gestiona reintentos.
const nodemailer = require('nodemailer');

// Envía un correo HTML a la bandeja del administrador con los datos de la PQRS recibida.
//
// Parámetros (objeto desestructurado):
//   tipo        — categoría de la solicitud ('peticion', 'queja', 'reclamo' o 'sugerencia').
//   asunto      — título breve de la PQRS escrito por el trabajador.
//   descripcion — texto completo del mensaje; se renderiza con white-space:pre-wrap para
//                 preservar los saltos de línea que el trabajador haya escrito.
//   remitente   — user_name del trabajador autenticado, extraído del JWT por el controlador.
//
// Destinatario:
//   El correo se envía a process.env.GMAIL_USER, es decir, a la misma cuenta que actúa
//   como remitente SMTP. Esto significa que el administrador recibe las PQRS en su propia
//   bandeja de entrada. No se notifica al trabajador que envió la PQRS porque el sistema
//   no gestiona conversaciones: la comunicación de respuesta ocurre fuera del sistema.
//
// Asunto del correo:
//   El formato "[PQRS SIAPE] tipo - asunto" facilita crear reglas de filtrado automático
//   en el cliente de correo del administrador para organizar las PQRS en una carpeta dedicada.
//
// Comportamiento ante errores:
//   Si sendMail lanza una excepción (credenciales inválidas, timeout de red, etc.) este
//   servicio la registra en consola y la vuelve a lanzar. El controlador (pqrs.controller)
//   captura ese error en silencio dentro del bloque fire-and-forget, porque la respuesta
//   HTTP ya fue enviada al trabajador antes de despachar el correo.
async function send({ tipo, asunto, descripcion, remitente }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    port: 587,
    secure: false,      // false = STARTTLS en puerto 587, no SSL directo
    requireTLS: true,   // fuerza la elevación a TLS antes de enviar credenciales
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    connectionTimeout: 10000,  // ms máximos para establecer la conexión TCP
    greetingTimeout:   10000,  // ms máximos para recibir el saludo SMTP del servidor
  });

  try {
    await transporter.sendMail({
      from:    `"SIAPE" <${process.env.GMAIL_USER}>`,
      to:      process.env.GMAIL_USER,  // la PQRS llega a la bandeja del administrador
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
