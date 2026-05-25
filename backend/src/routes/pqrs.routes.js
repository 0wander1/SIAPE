const { Router } = require('express');
const pqrsController = require('../controllers/pqrs.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/pqrs
router.post('/', verifyToken, pqrsController.send);

module.exports = router;
