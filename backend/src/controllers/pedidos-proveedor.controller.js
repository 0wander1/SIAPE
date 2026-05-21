const pedidosProveedorService = require('../services/pedidos-proveedor.service');

async function getAll(req, res, next) {
  try {
    const pedidos = await pedidosProveedorService.getAll();
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const pedido = await pedidosProveedorService.getById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido a proveedor no encontrado.' });
    }
    return res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { proveedor_id_proveedor, items } = req.body;

    if (!proveedor_id_proveedor) {
      return res.status(400).json({ message: 'El campo proveedor_id_proveedor es requerido.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'El pedido debe incluir al menos un item.' });
    }

    const itemInvalido = items.find((i) => !i.producto_id_producto || !i.cantidad);
    if (itemInvalido) {
      return res.status(400).json({
        message: 'Cada item debe tener producto_id_producto y cantidad.',
      });
    }

    const nuevo = await pedidosProveedorService.create(req.body);
    return res.status(201).json({ message: 'Pedido a proveedor creado exitosamente.', pedido: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await pedidosProveedorService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Pedido a proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido a proveedor actualizado exitosamente.', pedido: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await pedidosProveedorService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Pedido a proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido a proveedor eliminado exitosamente.' });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
