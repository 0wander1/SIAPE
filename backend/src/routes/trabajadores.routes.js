const { Router } = require('express');
const trabajadoresController = require('../controllers/trabajadores.controller');
// verifyToken valida el JWT antes de que la petición alcance el controlador.
// Se aplica a cada ruta porque la gestión de trabajadores es una operación
// administrativa que solo usuarios autenticados pueden realizar.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/trabajadores
// Devuelve todos los trabajadores con sus columnas públicas (sin password_hash ni salt).
// La selección explícita de columnas en el servicio garantiza que los datos sensibles
// nunca salgan de la BD hacia el cliente, incluso si la tabla añade columnas en el futuro.
router.get('/',       verifyToken, trabajadoresController.getAll);

// GET /api/trabajadores/:id
// Devuelve un trabajador específico por su PK (id_usuario_trab). Responde 404 si no existe.
// También excluye password_hash y salt de la respuesta usando COLUMNAS_PUBLICAS.
router.get('/:id',    verifyToken, trabajadoresController.getById);

// POST /api/trabajadores
// Crea un trabajador en una transacción de dos pasos:
//   1. INSERT en "usuario" para registrar el nombre genérico del sistema.
//   2. INSERT en "usuario_trab" usando la PK recién generada, con la contraseña
//      hasheada con bcrypt (nunca en texto plano) y la sal individual almacenada.
// Campos obligatorios: cargo, user_name, password.
// Campos opcionales: direccion, turno, celular.
router.post('/',      verifyToken, trabajadoresController.create);

// PUT /api/trabajadores/:id
// Tiene dos modos de operación según los campos del body:
//   a) Cambio de contraseña: si el body incluye "contrasena_actual" y "nueva_contrasena",
//      el servicio verifica la contraseña actual con bcrypt antes de generar un nuevo hash.
//      Si la contraseña actual es incorrecta responde 401 Unauthorized.
//   b) Actualización de perfil: si el body incluye campos de la lista blanca
//      (cargo, direccion, turno, celular, user_name), los actualiza dinámicamente.
// Responde 404 si el trabajador no existe.
router.put('/:id',    verifyToken, trabajadoresController.update);

// DELETE /api/trabajadores/:id
// Elimina el trabajador de "usuario_trab". Responde 404 si no existía.
// No elimina la fila de "usuario" padre para preservar registros históricos.
router.delete('/:id', verifyToken, trabajadoresController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo "/trabajadores".
module.exports = router;
