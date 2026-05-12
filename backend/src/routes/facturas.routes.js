const { Router } = require('express');
const facturasController = require('../controllers/facturas.controller');
// verifyToken valida el JWT antes de que la petición alcance el controlador.
// La facturación es una operación crítica que solo usuarios autenticados pueden ejecutar.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/facturas
// Devuelve todas las facturas ordenadas por id descendente. Incluye todos los campos
// de la tabla: numero_factura, fechas, subtotal, impuesto, descuento, total, estado,
// usuario_trab_id y pedido_id_pedido (null si es venta directa).
router.get('/',       verifyToken, facturasController.getAll);

// GET /api/facturas/:id
// Devuelve una factura específica por su PK. Responde 404 si no existe.
router.get('/:id',    verifyToken, facturasController.getById);

// POST /api/facturas
// Crea una factura en dos modos distintos dentro de la misma transacción:
//
//   Modo A — Factura de pedido: si el body incluye "pedido_id_pedido", la factura
//     se vincula a ese pedido. El servicio verifica que el pedido no tenga ya una
//     factura (integridad 1:1 entre pedido y factura). No descuenta inventario porque
//     el pedido ya gestionó su propio flujo de stock.
//
//   Modo B — Venta directa: si "pedido_id_pedido" es nulo, el body debe incluir
//     un array "productos" con items {producto_id_producto, cantidad, valor_unitario}.
//     El servicio bloquea cada fila de inventario con FOR UPDATE, verifica stock
//     suficiente, descuenta las unidades y registra los items en "factura_item".
//
// En ambos modos el campo "total" se calcula automáticamente: subtotal + impuesto - descuento.
// Responde 409 si ya existe una factura para el pedido o si el número de factura está duplicado.
router.post('/',      verifyToken, facturasController.create);

// PUT /api/facturas/:id
// Actualiza parcialmente una factura. Si el body modifica subtotal, impuesto o descuento,
// el servicio recalcula automáticamente el campo "total" combinando los nuevos valores
// con los actuales almacenados en BD, para que total siempre sea consistente.
router.put('/:id',    verifyToken, facturasController.update);

// DELETE /api/facturas/:id
// Elimina la factura por su PK. Responde 404 si no existía.
// Si tiene pagos asociados en "pago" con ON DELETE RESTRICT, MySQL rechazará
// el DELETE y el errorHandler global devolverá 500.
router.delete('/:id', verifyToken, facturasController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/facturas".
module.exports = router;
