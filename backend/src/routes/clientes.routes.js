const { Router } = require('express');
const clientesController = require('../controllers/clientes.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, clientesController.getAll);
router.get('/:id',    verifyToken, clientesController.getById);
router.post('/',      verifyToken, clientesController.create);
router.put('/:id',    verifyToken, clientesController.update);
router.delete('/:id', verifyToken, clientesController.remove);

module.exports = router;
