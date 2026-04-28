const inventarioService = require('../services/inventario.service');

async function getAll(req, res, next) {
  try {
    const registros = await inventarioService.getAll();
    return res.status(200).json(registros);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const registro = await inventarioService.getById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: 'Registro de inventario no encontrado.' });
    }
    return res.status(200).json(registro);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { cantidad_disponible, producto_id_producto, bodega_id_bodega } = req.body;

    if (cantidad_disponible === undefined || !producto_id_producto || !bodega_id_bodega) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: cantidad_disponible, producto_id_producto, bodega_id_bodega.',
      });
    }

    const nuevo = await inventarioService.create(req.body);
    return res.status(201).json({ message: 'Registro de inventario creado exitosamente.', inventario: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await inventarioService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Registro de inventario no encontrado.' });
    }
    return res.status(200).json({ message: 'Inventario actualizado exitosamente.', inventario: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await inventarioService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Registro de inventario no encontrado.' });
    }
    return res.status(200).json({ message: 'Registro de inventario eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
