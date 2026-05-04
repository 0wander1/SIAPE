const clientesService = require('../services/clientes.service');

async function getAll(req, res, next) {
  try {
    const clientes = await clientesService.getAll();
    return res.status(200).json(clientes);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const cliente = await clientesService.getById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    return res.status(200).json(cliente);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    console.log(req.body);
    const { nombre_usuario, correo } = req.body;

    if (!nombre_usuario || !correo) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_usuario, correo.',
      });
    }

    const nuevo = await clientesService.create(req.body);
    return res.status(201).json({ message: 'Cliente creado exitosamente.', cliente: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await clientesService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ message: 'Cliente actualizado exitosamente.', cliente: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await clientesService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ message: 'Cliente eliminado exitosamente.' });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
