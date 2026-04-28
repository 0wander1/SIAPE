const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const router = Router();

// POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;
