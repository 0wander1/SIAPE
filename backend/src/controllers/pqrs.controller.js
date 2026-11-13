// El controlador valida los datos de entrada HTTP y delega el envío del correo al servicio.
// No construye ni envía correos directamente: esa responsabilidad es de pqrs.service,
// que envía el correo mediante la API de Resend.
const pqrsService = require('../services/pqrs.service');

// Recibe una PQRS del trabajador autenticado, valida los campos, espera a que el correo
// se envíe y solo entonces responde al cliente.
//
// A diferencia de auth.controller (envío del código de verificación, que es
// fire-and-forget), aquí se espera el envío con await: la PQRS no se guarda en la BD,
// así que el correo es la única constancia de que existe. Si se respondiera antes, un
// fallo del envío haría creer al trabajador que su PQRS llegó cuando en realidad se perdió.
//
// Respuestas:
//   400 — faltan campos o tipo no es una categoría válida.
//   200 — el correo se envió correctamente.
//   502 — el servicio de correo (Resend) falló; el error se registra con console.error
//         y se le pide al trabajador que intente de nuevo más tarde.
// Cualquier otro error inesperado se propaga con next() al middleware de errores.
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

    // tipo debe ser una de las cuatro categorías de PQRS. Se compara en minúsculas y sin
    // tildes (NFD separa la letra de su tilde y la regex elimina las marcas diacríticas),
    // así 'Petición', 'PETICION' y 'peticion' son equivalentes. Al servicio se le pasa el
    // tipo tal como llegó.
    const TIPOS_VALIDOS = ['peticion', 'queja', 'reclamo', 'sugerencia'];
    if (
      typeof tipo !== 'string' ||
      !TIPOS_VALIDOS.includes(tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
    ) {
      return res.status(400).json({ message: 'Tipo inválido. Debe ser Petición, Queja, Reclamo o Sugerencia.' });
    }

    // req.user.user_name es el identificador del trabajador autenticado, extraído del
    // payload del JWT por el middleware verifyToken. Se usa como remitente del correo
    // para que el administrador sepa quién envió la PQRS sin confiar en el body del cliente.
    const remitente = req.user.user_name;

    // Se espera a que el correo se envíe antes de responder, para que el trabajador sepa
    // si su PQRS llegó realmente. Si el envío falla se responde 502 (falla del servicio
    // de correo externo) en lugar de un 200 engañoso.
    try {
      await pqrsService.send({ tipo, asunto, descripcion, remitente });
    } catch (emailError) {
      console.error('Error al enviar PQRS:', emailError);
      return res.status(502).json({ message: 'No se pudo enviar el PQRS. Intenta de nuevo más tarde.' });
    }

    res.status(200).json({ message: 'PQRS enviado correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { send };
