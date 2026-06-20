const { Router } = require('express');
const negocioController = require('../controllers/negocio.controller');
// verifyToken valida el JWT en el header Authorization antes de que la petición
// alcance el controlador. Se aplica a ambas rutas porque la configuración del negocio
// es información administrativa que solo usuarios autenticados pueden consultar o modificar.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/negocio
// Devuelve el registro único de configuración del negocio (nombre, NIT, dirección,
// teléfono, correo y logo_url). La tabla "negocio" sigue un patrón singleton: siempre
// contiene exactamente una fila con id_negocio = 1. Responde 404 si esa fila no existe.
router.get('/', verifyToken, negocioController.get);

// PUT /api/negocio
// Actualiza los datos del negocio. Campos obligatorios: nombre, nit.
// Campos opcionales: direccion, telefono, correo, logo_url.
// El servicio ejecuta UPDATE WHERE id_negocio = 1 directamente sobre la fila única;
// no recibe un :id en la URL porque no hay ambigüedad de registro. Responde 404 si
// la fila singleton no existe (tabla vacía o sin inicializar).
router.put('/', verifyToken, negocioController.update);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/negocio",
// resultando en las rutas completas /api/negocio para GET y PUT.
module.exports = router;
