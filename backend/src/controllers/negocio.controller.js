const negocioService = require('../services/negocio.service');

async function get(req, res, next) {
  try {
    const negocio = await negocioService.get();
    if (!negocio) {
      return res.status(404).json({ message: 'Negocio no encontrado.' });
    }
    return res.status(200).json(negocio);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { nombre, nit, direccion, telefono, correo, logo_url } = req.body;

    if (!nombre || !nit) {
      return res.status(400).json({ message: 'Faltan campos requeridos: nombre, nit.' });
    }

    const result = await negocioService.update({ nombre, nit, direccion, telefono, correo, logo_url });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Negocio no encontrado.' });
    }

    return res.status(200).json({ message: 'Negocio actualizado correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { get, update };
