const { Router } = require('express');

const router = Router();

// Ruta de salud del API
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', require('./auth.routes'));
router.use('/pedidos', require('./pedidos.routes'));
router.use('/inventario', require('./inventario.routes'));
router.use('/productos', require('./productos.routes'));
router.use('/proveedores', require('./proveedores.routes'));
router.use('/clientes', require('./clientes.routes'));
router.use('/bodegas', require('./bodegas.routes'));
router.use('/trabajadores', require('./trabajadores.routes'));
router.use('/facturas', require('./facturas.routes'));
router.use('/pagos', require('./pagos.routes'));
router.use('/reportes', require('./reportes.routes'));
router.use('/pedidos-proveedor', require('./pedidos-proveedor.routes'));

module.exports = router;
