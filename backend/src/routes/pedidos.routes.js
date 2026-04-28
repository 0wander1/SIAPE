const { Router } = require('express');
const pedidosController = require('../controllers/pedidos.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',     verifyToken, pedidosController.getAll);
router.get('/:id',  verifyToken, pedidosController.getById);
router.post('/',    verifyToken, pedidosController.create);
router.put('/:id',  verifyToken, pedidosController.update);
router.delete('/:id', verifyToken, pedidosController.remove);

module.exports = router;
