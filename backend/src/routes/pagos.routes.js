const { Router } = require('express');
const pagosController = require('../controllers/pagos.controller');
// verifyToken valida el JWT antes de que la petición alcance el controlador.
// Se aplica a cada ruta porque registrar o modificar pagos es una operación financiera
// que solo usuarios autenticados del sistema pueden ejecutar.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/pagos
// Devuelve todos los pagos enriquecidos con el número de factura correspondiente,
// resuelto mediante LEFT JOIN con la tabla "factura". Los pagos se ordenan por id
// descendente (el más reciente primero).
router.get('/',       verifyToken, pagosController.getAll);

// GET /api/pagos/:id
// Devuelve un pago específico por su PK (id_pago). Responde 404 si no existe.
router.get('/:id',    verifyToken, pagosController.getById);

// POST /api/pagos
// Registra un nuevo pago parcial o total para una factura. El servicio:
//   1. Verifica que la factura exista.
//   2. Calcula el saldo pendiente actual (total factura - suma de pagos anteriores).
//   3. Rechaza el pago con HTTP 422 si el monto supera el saldo pendiente.
//   4. Inserta el pago en la tabla "pago".
//   5. Actualiza automáticamente el estado de la factura:
//        'pagada'  → si el nuevo saldo resulta en exactamente 0.
//        'parcial' → si aún queda saldo por cobrar.
// Campos obligatorios: monto_pagado, fecha_pago, metodo_pago,
//                      factura_id_factura, usuario_trab_id_usuario_trab.
// Campo opcional: referencia_transaccion (código de transferencia, número de cheque, etc.).
//
// ADVERTENCIA DE CONCURRENCIA: las verificaciones de saldo y la inserción se ejecutan
// en consultas separadas sin transacción ni FOR UPDATE. Dos peticiones simultáneas
// podrían leer el mismo saldo pendiente y ambas aprobar montos que sumados lo superen.
// Para corregirlo sería necesario envolver todo en beginTransaction() y aplicar
// FOR UPDATE al SELECT de la factura y al SUM de pagos anteriores.
router.post('/',      verifyToken, pagosController.create);

// PUT /api/pagos/:id
// Actualiza parcialmente un pago existente (monto, fecha, método, referencia, etc.).
// Solo modifica los campos presentes en el body que estén en la lista blanca del servicio.
// NOTA: modificar monto_pagado aquí no recalcula el estado de la factura; ese efecto
// solo ocurre en el create. Si se necesita recalcular, habría que extender este método.
router.put('/:id',    verifyToken, pagosController.update);

// DELETE /api/pagos/:id
// Elimina el pago por su PK. Responde 404 si no existía.
// No revierte el estado de la factura al eliminar un pago; si fuera necesario,
// habría que agregar esa lógica en el servicio.
router.delete('/:id', verifyToken, pagosController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/pagos".
module.exports = router;
