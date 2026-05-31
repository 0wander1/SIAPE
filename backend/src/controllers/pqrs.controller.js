const pqrsService = require('../services/pqrs.service');

async function send(req, res, next) {
  console.log('[pqrs] Handler ejecutado');
  console.log('[pqrs] Datos recibidos:', req.body);
  try {
    const { tipo, asunto, descripcion } = req.body;

    if (!tipo || !asunto || !descripcion) {
      return res.status(400).json({ message: 'Faltan campos requeridos: tipo, asunto, descripcion.' });
    }

    const remitente = req.user.user_name;

    res.status(200).json({ message: 'PQRS enviado correctamente.' });

    try {
      console.log('[pqrs] Intentando enviar...');
      await pqrsService.send({ tipo, asunto, descripcion, remitente });
      console.log('[pqrs] Enviado exitosamente');
    } catch (emailError) {
      console.error('[pqrs] Error:', emailError);
    }
  } catch (error) {
    console.error('[pqrs] Error:', error);
    next(error);
  }
}

module.exports = { send };
