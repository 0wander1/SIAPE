const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/reportes/ventas?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
router.get('/ventas',     verifyToken, reportesController.getReporteVentas);

// GET /api/reportes/inventario
router.get('/inventario', verifyToken, reportesController.getReporteInventario);

module.exports = router;
