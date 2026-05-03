const pedidosService = require('../services/pedidos.service');

async function getAll(req, res, next) {
  try {
    const pedidos = await pedidosService.getAll();
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const pedido = await pedidosService.getById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    }
    return res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    console.log('[pedidos.controller] create req.body:', req.body);
    const { cliente_id_usuario_cli, producto_id_producto, cantidad, estado, valor_total, direccion_pedido, usuario_trab_id } = req.body;

    if (!cliente_id_usuario_cli || !producto_id_producto || !cantidad || !estado || valor_total === undefined || valor_total === null || !direccion_pedido || !usuario_trab_id) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: cliente_id_usuario_cli, producto_id_producto, cantidad, estado, valor_total, direccion_pedido, usuario_trab_id.',
      });
    }

    const nuevo = await pedidosService.create(req.body);
    return res.status(201).json({ message: 'Pedido creado exitosamente.', pedido: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await pedidosService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido actualizado exitosamente.', pedido: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await pedidosService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido eliminado exitosamente.' });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
