const pagosService = require('../services/pagos.service');

async function getAll(req, res, next) {
  try {
    const pagos = await pagosService.getAll();
    return res.status(200).json(pagos);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const pago = await pagosService.getById(req.params.id);
    if (!pago) {
      return res.status(404).json({ message: 'Pago no encontrado.' });
    }
    return res.status(200).json(pago);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { monto_pagado, fecha_pago, metodo_pago, factura_id_factura, usuario_trab_id_usuario_trab } = req.body;

    if (!monto_pagado || !fecha_pago || !metodo_pago || !factura_id_factura || !usuario_trab_id_usuario_trab) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: monto_pagado, fecha_pago, metodo_pago, factura_id_factura, usuario_trab_id_usuario_trab.',
      });
    }

    const nuevo = await pagosService.create(req.body);
    return res.status(201).json({ message: 'Pago registrado exitosamente.', pago: nuevo });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizado = await pagosService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Pago no encontrado.' });
    }
    return res.status(200).json({ message: 'Pago actualizado exitosamente.', pago: actualizado });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const eliminado = await pagosService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Pago no encontrado.' });
    }
    return res.status(200).json({ message: 'Pago eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
