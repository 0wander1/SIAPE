// Enrutador raíz de la API. Centraliza el registro de todos los sub-routers del
// proyecto bajo sus respectivos prefijos y los expone como un único router que
// server.js monta bajo /api. Cualquier ruta definida en un sub-router queda
// disponible en /api/<prefijo>/<ruta> una vez registrada aquí.
// También expone el endpoint de salud /api/health, que no requiere autenticación
// y permite verificar que el servidor está en línea sin consultar la base de datos.
const { Router } = require('express');

const router = Router();

// GET /api/health — comprueba que el servidor está activo; retorna { status, timestamp }.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// /api/auth — inicio de sesión en dos pasos (credenciales + verificación de código por correo).
router.use('/auth', require('./auth.routes'));

// /api/pedidos — pedidos externos realizados por clientes.
router.use('/pedidos', require('./pedidos.routes'));

// /api/inventario — registros de stock por producto y bodega; incluye carga masiva desde Excel.
router.use('/inventario', require('./inventario.routes'));

// /api/productos — catálogo de productos con sus precios y datos de lote.
router.use('/productos', require('./productos.routes'));

// /api/proveedores — proveedores del negocio y sus productos asociados en producto_has_proveedor.
router.use('/proveedores', require('./proveedores.routes'));

// /api/clientes — clientes del negocio; cada cliente extiende un registro de usuario.
router.use('/clientes', require('./clientes.routes'));

// /api/bodegas — bodegas de almacenamiento con su capacidad, tipo y responsable.
router.use('/bodegas', require('./bodegas.routes'));

// /api/trabajadores — trabajadores del sistema; gestiona perfil y cambio de contraseña.
router.use('/trabajadores', require('./trabajadores.routes'));

// /api/facturas — facturas de pedido y de venta directa con descuento de inventario.
router.use('/facturas', require('./facturas.routes'));

// /api/pagos — pagos asociados a facturas; actualiza automáticamente el estado de la factura.
router.use('/pagos', require('./pagos.routes'));

// /api/reportes — reportes de ventas, stock crítico, proveedores, trabajadores y costos.
router.use('/reportes', require('./reportes.routes'));

// /api/pedidos-proveedor — órdenes de compra a proveedores; al recibirlas incrementa el inventario.
router.use('/pedidos-proveedor', require('./pedidos-proveedor.routes'));

// /api/negocio — configuración del negocio (registro singleton: nombre, NIT, contacto, logo).
router.use('/negocio', require('./negocio.routes'));

// /api/pqrs — peticiones, quejas, reclamos y sugerencias; notifica al administrador por correo.
router.use('/pqrs', require('./pqrs.routes'));

module.exports = router;
