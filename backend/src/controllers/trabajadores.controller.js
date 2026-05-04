const trabajadoresService = require('../services/trabajadores.service');

async function getAll(req, res, next) {
  try {
    const trabajadores = await trabajadoresService.getAll();
    return res.status(200).json(trabajadores);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const trabajador = await trabajadoresService.getById(req.params.id);
    if (!trabajador) {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(200).json(trabajador);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { cargo, user_name, password } = req.body;

    if (!cargo || !user_name || !password) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: cargo, user_name, password.',
      });
    }

    const nuevo = await trabajadoresService.create(req.body);
    return res.status(201).json({ message: 'Trabajador creado exitosamente.', trabajador: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await trabajadoresService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(200).json({ message: 'Trabajador actualizado exitosamente.', trabajador: actualizado });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await trabajadoresService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(200).json({ message: 'Trabajador eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
