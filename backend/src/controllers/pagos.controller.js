// El controlador valida los datos de entrada HTTP y delega toda la lógica financiera
// al servicio. No calcula saldos, no actualiza estados de facturas ni gestiona pagos parciales.
const pagosService = require('../services/pagos.service');

// Devuelve todos los pagos con el número de factura resuelto. Array vacío es 200 válido.
async function getAll(req, res, next) {
  try {
    const pagos = await pagosService.getAll();
    return res.status(200).json(pagos);
  } catch (error) {
    next(error);
  }
}

// Busca un pago por su PK. El servicio retorna null si no existe → 404.
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

// Registra un nuevo pago. Valida la presencia de los cinco campos obligatorios
// antes de llegar al servicio, que realizará la verificación de saldo y actualizará
// el estado de la factura.
async function create(req, res, next) {
  try {
    const { monto_pagado, fecha_pago, metodo_pago, factura_id_factura, usuario_trab_id_usuario_trab } = req.body;

    // Se usa ! para todos los campos porque:
    //   - monto_pagado: un valor 0 o negativo no es un pago válido, por lo que ! es correcto.
    //   - Los demás campos son strings o enteros; cualquier valor falsy es inválido.
    // El campo opcional "referencia_transaccion" no se valida aquí; el servicio lo recibe
    // desde req.body completo y lo trata con ?? null si no viene.
    if (!monto_pagado || !fecha_pago || !metodo_pago || !factura_id_factura || !usuario_trab_id_usuario_trab) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: monto_pagado, fecha_pago, metodo_pago, factura_id_factura, usuario_trab_id_usuario_trab.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba también referencia_transaccion.
    const nuevo = await pagosService.create(req.body);
    // HTTP 201 Created: se generó una nueva fila en "pago" y se actualizó "factura".
    // Los errores del servicio (404 factura no encontrada, 422 monto excedido) se propagan
    // a next(error) y el errorHandler global los convierte en la respuesta HTTP correcta.
    return res.status(201).json({ message: 'Pago registrado exitosamente.', pago: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza campos de un pago existente. La lista blanca de campos permitidos
// se controla en el servicio. null del servicio → 404.
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

// Elimina un pago por su PK. false del servicio → 404.
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
