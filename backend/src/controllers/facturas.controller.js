const facturasService = require('../services/facturas.service');

async function getAll(req, res, next) {
  try {
    const facturas = await facturasService.getAll();
    return res.status(200).json(facturas);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const factura = await facturasService.getById(req.params.id);
    if (!factura) {
      return res.status(404).json({ message: 'Factura no encontrada.' });
    }
    return res.status(200).json(factura);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { numero_factura, fecha_emision, subtotal, estado, usuario_trab_id, pedido_id_pedido } = req.body;

    if (!numero_factura || !fecha_emision || subtotal === undefined || !estado || !usuario_trab_id || !pedido_id_pedido) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: numero_factura, fecha_emision, subtotal, estado, usuario_trab_id, pedido_id_pedido.',
      });
    }

    const nueva = await facturasService.create(req.body);
    return res.status(201).json({ message: 'Factura creada exitosamente.', factura: nueva });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizada = await facturasService.update(req.params.id, req.body);
    if (!actualizada) {
      return res.status(404).json({ message: 'Factura no encontrada.' });
    }
    return res.status(200).json({ message: 'Factura actualizada exitosamente.', factura: actualizada });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminada = await facturasService.remove(req.params.id);
    if (!eliminada) {
      return res.status(404).json({ message: 'Factura no encontrada.' });
    }
    return res.status(200).json({ message: 'Factura eliminada exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
