const { Router } = require('express');
const facturasController = require('../controllers/facturas.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, facturasController.getAll);
router.get('/:id',    verifyToken, facturasController.getById);
router.post('/',      verifyToken, facturasController.create);
router.put('/:id',    verifyToken, facturasController.update);
router.delete('/:id', verifyToken, facturasController.remove);

module.exports = router;
