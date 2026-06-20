const { Router } = require('express');
const pedidosProveedorController = require('../controllers/pedidos-proveedor.controller');
// verifyToken valida el JWT en el header Authorization antes de que la petición
// alcance el controlador. Se aplica a cada ruta para proteger todo el recurso
// /api/pedidos-proveedor, ya que gestionar compras a proveedores es una operación
// administrativa que solo usuarios autenticados pueden ejecutar.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/pedidos-proveedor
// Devuelve todos los pedidos a proveedor ordenados por id descendente. Cada pedido
// incluye el nombre del proveedor, el user_name del trabajador responsable y el
// array "items" con los productos y cantidades solicitados.
router.get('/',       verifyToken, pedidosProveedorController.getAll);

// GET /api/pedidos-proveedor/:id
// Devuelve un pedido a proveedor específico identificado por su PK. La respuesta
// incluye el array "items" cargado con una consulta separada para evitar N+1.
// Responde 404 si el pedido no existe.
router.get('/:id',    verifyToken, pedidosProveedorController.getById);

// POST /api/pedidos-proveedor
// Crea un pedido a proveedor con sus items dentro de una transacción. El controlador
// valida que proveedor_id_proveedor esté presente, que items sea un array no vacío y
// que cada item tenga producto_id_producto y cantidad. El servicio además actualiza
// el precio de compra en producto_has_proveedor y el valor_neto del producto por
// cada item recibido. Responde 201 con el pedido completo recién creado.
router.post('/',      verifyToken, pedidosProveedorController.create);

// PUT /api/pedidos-proveedor/:id
// Actualiza los campos del pedido identificado por :id. Cuando el body incluye
// estado: 'recibido', el servicio abre una transacción que además del UPDATE del
// pedido incrementa la cantidad_disponible en inventario por cada item, usando la
// bodega indicada en bodega_id. Si el pedido ya tenía estado 'recibido', el servicio
// lanza un error 409 Conflict para evitar duplicar el ingreso al inventario.
// Responde 404 si el pedido no existe.
router.put('/:id',    verifyToken, pedidosProveedorController.update);

// DELETE /api/pedidos-proveedor/:id
// Elimina un pedido a proveedor por su PK. El servicio impide la eliminación si el
// pedido tiene estado 'recibido', ya que sus items ya incrementaron el inventario y
// eliminar el pedido dejaría ese movimiento sin trazabilidad; en ese caso responde
// 409 Conflict. Responde 404 si el pedido no existe.
router.delete('/:id', verifyToken, pedidosProveedorController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo
// "/pedidos-proveedor", resultando en rutas completas como /api/pedidos-proveedor.
module.exports = router;
