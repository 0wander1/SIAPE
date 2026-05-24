// Router es la clase de Express que permite definir grupos de rutas de forma modular.
// Cada archivo de rutas crea su propio Router y lo exporta; el enrutador raíz
// (src/routes/index.js) los monta bajo un prefijo común, por ejemplo "/api/auth".
const { Router } = require('express');

// Se importa el controlador de autenticación que contiene la lógica de cada endpoint.
// Separar rutas de controladores mantiene este archivo enfocado únicamente en el mapeo
// de URLs a funciones, sin mezclar lógica de negocio.
const authController = require('../controllers/auth.controller');

const router = Router();

// POST /api/auth/login
// Define el endpoint de inicio de sesión. Solo acepta el método HTTP POST porque
// envía credenciales (user_name y password) en el cuerpo de la petición, lo que
// es más seguro que enviarlas en la URL (donde quedarían en logs del servidor y
// en el historial del navegador, como ocurriría con un GET).
// Cuando la petición llega, Express delega el control a authController.login.
router.post('/login',       authController.login);
router.post('/verify-code', authController.verifyCode);

module.exports = router;
