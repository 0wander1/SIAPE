const { Router } = require('express');
const productosController = require('../controllers/productos.controller');
// verifyToken valida el JWT en el header Authorization antes de que la petición
// alcance el controlador. Se aplica a cada ruta para proteger todo el recurso /api/productos.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/productos
// Devuelve todos los productos ordenados alfabéticamente por nombre.
// No requiere parámetros; un array vacío es una respuesta 200 válida.
router.get('/',       verifyToken, productosController.getAll);

// GET /api/productos/:id
// Devuelve un producto específico por su PK. Responde 404 si no existe.
// Express captura el valor dinámico ":id" y lo expone en req.params.id.
router.get('/:id',    verifyToken, productosController.getById);

// POST /api/productos
// Crea un nuevo producto y, de forma automática dentro de la misma operación,
// crea el registro de inventario inicial asociado en la bodega indicada.
// Requiere: nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega.
// Opcionales: lote, fecha_vencimiento, cantidad, cantidad_minima.
router.post('/',      verifyToken, productosController.create);

// PUT /api/productos/:id
// Actualiza todos los campos del producto identificado por :id.
// A diferencia de inventario, este UPDATE no es parcial: exige los mismos
// campos obligatorios que el create para mantener la integridad del registro.
router.put('/:id',    verifyToken, productosController.update);

// DELETE /api/productos/:id
// Elimina el producto solo si no tiene pedidos externos asociados.
// Si los tiene, el servicio lanza un error 409 Conflict para preservar
// la integridad referencial entre producto y pedido_externo.
router.delete('/:id', verifyToken, productosController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo "/productos",
// resultando en rutas completas como /api/productos y /api/productos/:id.
module.exports = router;
