const { Router } = require('express');
const negocioController = require('../controllers/negocio.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/negocio
router.get('/', verifyToken, negocioController.get);

// PUT /api/negocio
router.put('/', verifyToken, negocioController.update);

module.exports = router;
