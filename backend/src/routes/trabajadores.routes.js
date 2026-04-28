const { Router } = require('express');
const trabajadoresController = require('../controllers/trabajadores.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/',       verifyToken, trabajadoresController.getAll);
router.get('/:id',    verifyToken, trabajadoresController.getById);
router.post('/',      verifyToken, trabajadoresController.create);
router.put('/:id',    verifyToken, trabajadoresController.update);
router.delete('/:id', verifyToken, trabajadoresController.remove);

module.exports = router;
