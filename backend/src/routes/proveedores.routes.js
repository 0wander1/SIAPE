const { Router } = require('express');
const proveedoresController = require('../controllers/proveedores.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, proveedoresController.getAll);
router.get('/:id',    verifyToken, proveedoresController.getById);
router.post('/',      verifyToken, proveedoresController.create);
router.put('/:id',    verifyToken, proveedoresController.update);
router.delete('/:id', verifyToken, proveedoresController.remove);

module.exports = router;
