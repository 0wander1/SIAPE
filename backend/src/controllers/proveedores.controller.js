const proveedoresService = require('../services/proveedores.service');

async function getAll(req, res, next) {
  try {
    const proveedores = await proveedoresService.getAll();
    return res.status(200).json(proveedores);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const proveedor = await proveedoresService.getById(req.params.id);
    if (!proveedor) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json(proveedor);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { nombre_proveedor, NIT, id_usuario_trab } = req.body;

    if (!nombre_proveedor || !NIT || !id_usuario_trab) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_proveedor, NIT, id_usuario_trab.',
      });
    }

    const nuevo = await proveedoresService.create(req.body);
    return res.status(201).json({ message: 'Proveedor creado exitosamente.', proveedor: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await proveedoresService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Proveedor actualizado exitosamente.', proveedor: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await proveedoresService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
