const { Router } = require('express');
const productosController = require('../controllers/productos.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, productosController.getAll);
router.get('/:id',    verifyToken, productosController.getById);
router.post('/',      verifyToken, productosController.create);
router.put('/:id',    verifyToken, productosController.update);
router.delete('/:id', verifyToken, productosController.remove);

module.exports = router;
