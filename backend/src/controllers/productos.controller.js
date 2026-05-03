const productosService = require('../services/productos.service');

async function getAll(req, res, next) {
  try {
    const productos = await productosService.getAll();
    return res.status(200).json(productos);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const producto = await productosService.getById(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json(producto);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    console.log(req.body);
    const { nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega } = req.body;
    if (!nombre_producto || valor_neto == null || valor_de_venta == null || !bodega_id_bodega) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega.',
      });
    }
    const nuevo = await productosService.create(req.body);
    return res.status(201).json({ message: 'Producto creado exitosamente.', producto: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega } = req.body;
    if (!nombre_producto || valor_neto == null || valor_de_venta == null || !bodega_id_bodega) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega.',
      });
    }
    const actualizado = await productosService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json({ message: 'Producto actualizado exitosamente.', producto: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await productosService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json({ message: 'Producto eliminado exitosamente.' });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
