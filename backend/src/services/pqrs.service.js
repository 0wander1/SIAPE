// Servicio de envío de correos para el módulo de PQRS (Peticiones, Quejas, Reclamos y Sugerencias).
// Utiliza Resend (mismo patrón que email.service.js) con la API key de RESEND_API_KEY
// para notificar al administrador del negocio cada vez que un trabajador envía una PQRS.
// Este servicio solo despacha el correo; no persiste registros en la BD ni gestiona reintentos.
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Escapa los caracteres especiales de HTML para que el texto escrito por el trabajador
// se muestre literalmente en el correo y no se interprete como marcado.
// & se reemplaza primero para no volver a escapar las entidades generadas después.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
//   El correo se envía a process.env.PQRS_DESTINO, la dirección del administrador que
//   recibe las PQRS. No se notifica al trabajador que envió la PQRS porque el sistema
//   no gestiona conversaciones: la comunicación de respuesta ocurre fuera del sistema.
//
// Asunto del correo:
//   El formato "[PQRS SIAPE] tipo - asunto" facilita crear reglas de filtrado automático
//   en el cliente de correo del administrador para organizar las PQRS en una carpeta dedicada.
//
// Comportamiento ante errores:
//   Si PQRS_DESTINO no está definida se lanza un Error antes de llamar a Resend.
//   Si Resend devuelve un error (API key inválida, dominio no verificado, etc.) o la llamada
//   lanza una excepción, este servicio la registra en consola y la vuelve a lanzar. El
//   controlador (pqrs.controller) captura ese error en silencio dentro del bloque
//   fire-and-forget, porque la respuesta HTTP ya fue enviada al trabajador antes de
//   despachar el correo.
async function send({ tipo, asunto, descripcion, remitente }) {
  try {
    // Sin destinatario la PQRS se perdería: se falla antes de llamar a Resend con un
    // mensaje que indica exactamente qué falta configurar.
    if (!process.env.PQRS_DESTINO) {
      throw new Error('La variable de entorno PQRS_DESTINO no está definida; no se puede enviar la PQRS.');
    }

    const { error } = await resend.emails.send({
      from:    'noreply@siape.site',
      to:      process.env.PQRS_DESTINO,  // la PQRS llega a la bandeja del administrador
      subject: `[PQRS SIAPE] ${String(tipo).replace(/[\r\n]+/g, ' ')} - ${String(asunto).replace(/[\r\n]+/g, ' ')}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="margin:0 0 24px;color:#111827">Nueva PQRS recibida</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151;width:120px;border-radius:4px 0 0 4px">Tipo</td>
              <td style="padding:10px 12px;color:#111827">${escapeHtml(tipo)}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151">Asunto</td>
              <td style="padding:10px 12px;color:#111827">${escapeHtml(asunto)}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151">Remitente</td>
              <td style="padding:10px 12px;color:#111827">${escapeHtml(remitente)}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151;vertical-align:top">Descripción</td>
              <td style="padding:10px 12px;color:#111827;white-space:pre-wrap">${escapeHtml(descripcion)}</td>
            </tr>
          </table>
        </div>
      `,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error Resend (PQRS):', error);
    throw error;
  }
}

module.exports = { send };
