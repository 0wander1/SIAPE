const { Router } = require('express');
const pagosController = require('../controllers/pagos.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, pagosController.getAll);
router.get('/:id',    verifyToken, pagosController.getById);
router.post('/',      verifyToken, pagosController.create);
router.put('/:id',    verifyToken, pagosController.update);
router.delete('/:id', verifyToken, pagosController.remove);

module.exports = router;
