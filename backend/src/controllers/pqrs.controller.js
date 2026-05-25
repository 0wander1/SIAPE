const pqrsService = require('../services/pqrs.service');

async function send(req, res, next) {
  try {
    const { tipo, asunto, descripcion } = req.body;

    if (!tipo || !asunto || !descripcion) {
      return res.status(400).json({ message: 'Faltan campos requeridos: tipo, asunto, descripcion.' });
    }

    const remitente = req.user.user_name;

    await pqrsService.send({ tipo, asunto, descripcion, remitente });

    return res.status(200).json({ message: 'PQRS enviado correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { send };
