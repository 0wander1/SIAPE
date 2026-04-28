const { Router } = require('express');

const router = Router();

// Ruta de salud del API
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', require('./auth.routes'));
router.use('/pedidos', require('./pedidos.routes'));
router.use('/inventario', require('./inventario.routes'));
// router.use('/empleados', require('./empleados.routes'));

module.exports = router;
