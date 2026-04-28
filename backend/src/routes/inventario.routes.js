const { Router } = require('express');
const inventarioController = require('../controllers/inventario.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, inventarioController.getAll);
router.get('/:id',    verifyToken, inventarioController.getById);
router.post('/',      verifyToken, inventarioController.create);
router.put('/:id',    verifyToken, inventarioController.update);
router.delete('/:id', verifyToken, inventarioController.remove);

module.exports = router;
