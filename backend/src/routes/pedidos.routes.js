const { Router } = require('express');
const pedidosController = require('../controllers/pedidos.controller');
// verifyToken es el middleware de autenticación que valida el JWT en el header
// Authorization antes de que la petición llegue al controlador. Se aplica
// individualmente a cada ruta para proteger todo el recurso /api/pedidos.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/pedidos
// Devuelve todos los pedidos externos registrados en el sistema, ordenados del más
// reciente al más antiguo. Solo accesible con token JWT válido.
router.get('/',     verifyToken, pedidosController.getAll);

// GET /api/pedidos/:id
// Devuelve un pedido específico identificado por su PK numérica en el segmento de URL.
// Express captura el valor dinámico ":id" y lo expone en req.params.id dentro del controlador.
router.get('/:id',  verifyToken, pedidosController.getById);

// POST /api/pedidos
// Crea un nuevo pedido externo. El cuerpo JSON debe incluir todos los campos obligatorios
// (cliente, producto, cantidad, estado, valor_total, dirección y usuario_trab_id).
// El servicio también inserta automáticamente un registro en la tabla "tiempo" y vincula
// ambas filas en la misma transacción para garantizar la integridad de los datos.
router.post('/',    verifyToken, pedidosController.create);

// PUT /api/pedidos/:id
// Actualiza uno o varios campos de un pedido existente. Solo se modifican los campos
// que vengan en el body y estén en la lista blanca del servicio. Si el campo "estado"
// cambia a "entregado", el servicio establece automáticamente fecha_entrega_real = NOW().
router.put('/:id',  verifyToken, pedidosController.update);

// DELETE /api/pedidos/:id
// Elimina un pedido siempre que no tenga una factura asociada. Si la tiene, el servicio
// lanza un error 409 Conflict para preservar la integridad referencial de la BD.
router.delete('/:id', verifyToken, pedidosController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/pedidos",
// haciendo que las rutas completas sean /api/pedidos, /api/pedidos/:id, etc.
module.exports = router;
