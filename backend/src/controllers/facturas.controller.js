// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No contiene cálculos de total, consultas SQL ni gestión de transacciones.
const facturasService = require('../services/facturas.service');

// Devuelve todas las facturas. Un array vacío es una respuesta 200 válida.
async function getAll(req, res, next) {
  try {
    const facturas = await facturasService.getAll();
    return res.status(200).json(facturas);
  } catch (error) {
    next(error);
  }
}

// Busca una factura por su PK. El servicio retorna null si no existe → 404.
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

// Crea una factura. Valida solo la presencia de los campos obligatorios comunes
// a ambos modos (pedido y venta directa); el servicio valida las reglas específicas
// de cada modo (unicidad del pedido, stock disponible, items válidos).
async function create(req, res, next) {
  try {
    console.log(req.body);
    const { numero_factura, fecha_emision, subtotal, estado, usuario_trab_id } = req.body;

    // subtotal se compara con === undefined porque el valor 0 es falsy en JavaScript
    // pero podría ser un subtotal legítimo (aunque poco probable en la práctica).
    // Los demás campos se validan con ! porque una cadena vacía o 0 son igualmente inválidos.
    if (!numero_factura || !fecha_emision || subtotal === undefined || !estado || !usuario_trab_id) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: numero_factura, fecha_emision, subtotal, estado, usuario_trab_id.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba pedido_id_pedido y
    // el array "productos" en venta directa, además de los campos opcionales
    // impuesto, descuento y fecha_vencimiento.
    const nueva = await facturasService.create(req.body);
    // HTTP 201 Created: se generó al menos una fila nueva (factura y posiblemente factura_item).
    return res.status(201).json({ message: 'Factura creada exitosamente.', factura: nueva });
  } catch (error) {
    // Se capturan dos fuentes de conflicto de unicidad:
    //   - error.status === 409: lanzado explícitamente por el servicio cuando ya existe
    //     una factura para el mismo pedido (verificación previa con SELECT).
    //   - error.code === 'ER_DUP_ENTRY': lanzado por MySQL cuando numero_factura viola
    //     un índice UNIQUE en la tabla, porque dos facturas no pueden tener el mismo número.
    // Ambos casos se mapean a HTTP 409 Conflict con un mensaje descriptivo.
    if (error.code === 'ER_DUP_ENTRY' || error.status === 409) {
      return res.status(409).json({ message: error.message || 'Ya existe una factura para ese pedido.' });
    }
    next(error);
  }
}

// Actualiza parcialmente una factura. Si se modifican subtotal, impuesto o descuento,
// el servicio recalcula total automáticamente. El controlador solo mapea null → 404.
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

// Elimina una factura por su PK. false del servicio → 404.
// Errores de FK de MySQL llegan a next(error) → errorHandler → 500.
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
