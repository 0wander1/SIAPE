const { Router } = require('express');
const bodegasController = require('../controllers/bodegas.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, bodegasController.getAll);
router.get('/:id',    verifyToken, bodegasController.getById);
router.post('/',      verifyToken, bodegasController.create);
router.put('/:id',    verifyToken, bodegasController.update);
router.delete('/:id', verifyToken, bodegasController.remove);

module.exports = router;
