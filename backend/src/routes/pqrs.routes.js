const { Router } = require('express');
const pqrsController = require('../controllers/pqrs.controller');
// verifyToken valida el JWT en el header Authorization antes de que la petición
// alcance el controlador. Se aplica a esta ruta porque solo trabajadores autenticados
// pueden enviar una PQRS; además el controlador extrae el remitente directamente del
// payload del JWT (req.user.user_name) para evitar que el cliente lo falsifique.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/pqrs
// Recibe una PQRS del trabajador autenticado y la notifica por correo al administrador.
// Campos obligatorios en el body: tipo, asunto, descripcion.
// El campo remitente no se envía en el body: el controlador lo lee de req.user.user_name,
// que es el user_name extraído del JWT por verifyToken.
// El controlador responde 200 al cliente de inmediato y luego despacha el correo en
// segundo plano (fire-and-forget), de modo que una eventual lentitud del servidor SMTP
// no bloquee la respuesta al trabajador.
router.post('/', verifyToken, pqrsController.send);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/pqrs",
// resultando en la ruta completa /api/pqrs.
module.exports = router;
