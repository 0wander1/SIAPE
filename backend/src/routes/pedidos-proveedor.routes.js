const { Router } = require('express');
const pedidosProveedorController = require('../controllers/pedidos-proveedor.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, pedidosProveedorController.getAll);
router.get('/:id',    verifyToken, pedidosProveedorController.getById);
router.post('/',      verifyToken, pedidosProveedorController.create);
router.put('/:id',    verifyToken, pedidosProveedorController.update);
router.delete('/:id', verifyToken, pedidosProveedorController.remove);

module.exports = router;
