// El controlador valida los datos de entrada HTTP y delega el envío del correo al servicio.
// No construye ni envía correos directamente: esa responsabilidad es de pqrs.service,
// que a su vez utiliza nodemailer a través de email.service.
const pqrsService = require('../services/pqrs.service');

// Recibe una PQRS del trabajador autenticado, responde al cliente de inmediato y luego
// despacha el correo en segundo plano (patrón fire-and-forget).
//
// El patrón fire-and-forget se usa aquí por la misma razón que en auth.controller (envío
// de código de verificación): el envío de correo puede tardar varios segundos dependiendo
// del servidor SMTP. Enviar la respuesta HTTP antes de que el correo complete garantiza
// que el cliente perciba una respuesta rápida aunque el servidor de correo sea lento.
//
// Consecuencia: si el correo falla después de que el cliente ya recibió el 200, ese error
// no puede llegar al cliente (la respuesta ya fue enviada). Por eso el try/catch interno
// captura el error en silencio en lugar de propagarlo con next().
//
// req.body debe contener: tipo, asunto, descripcion.
// req.user (inyectado por verifyToken) proporciona el user_name del remitente sin necesidad
// de que el cliente lo envíe explícitamente, evitando que un usuario pueda suplantar a otro.
async function send(req, res, next) {
  try {
    const { tipo, asunto, descripcion } = req.body;

    // Los tres campos son obligatorios para que el correo sea informativo.
    // ! es suficiente porque una cadena vacía también es inválida para estos campos.
    if (!tipo || !asunto || !descripcion) {
      return res.status(400).json({ message: 'Faltan campos requeridos: tipo, asunto, descripcion.' });
    }

    // req.user.user_name es el identificador del trabajador autenticado, extraído del
    // payload del JWT por el middleware verifyToken. Se usa como remitente del correo
    // para que el administrador sepa quién envió la PQRS sin confiar en el body del cliente.
    const remitente = req.user.user_name;

    // Se responde 200 antes de despachar el correo (fire-and-forget).
    // A partir de aquí no se puede llamar a res.json() ni a next() porque la respuesta
    // HTTP ya fue enviada; cualquier error posterior solo puede registrarse internamente.
    res.status(200).json({ message: 'PQRS enviado correctamente.' });

    try {
      await pqrsService.send({ tipo, asunto, descripcion, remitente });
    } catch (emailError) {
      // El error del servicio de correo se captura aquí en silencio porque la respuesta
      // al cliente ya fue enviada y no puede modificarse. En un entorno de producción
      // este error debería registrarse en un sistema de logging (Winston, Sentry, etc.).
    }
  } catch (error) {
    next(error);
  }
}

module.exports = { send };
