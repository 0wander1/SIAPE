const { Router } = require('express');
const clientesController = require('../controllers/clientes.controller');
// verifyToken valida el JWT antes de que la petición alcance el controlador.
// Se aplica a cada ruta para proteger todo el recurso /api/clientes.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/clientes
// Devuelve todos los clientes con su nombre y correo resueltos mediante INNER JOIN
// entre las tablas "cliente" y "usuario", ordenados por id descendente.
router.get('/',       verifyToken, clientesController.getAll);

// GET /api/clientes/:id
// Devuelve un cliente específico por su PK (id_usuario_cli). Responde 404 si no existe.
// El mismo id es PK en "cliente" y FK en "usuario", por eso identifica ambas tablas.
router.get('/:id',    verifyToken, clientesController.getById);

// POST /api/clientes
// Crea un cliente en una transacción de dos pasos:
//   1. INSERT en "usuario" para registrar el nombre.
//   2. INSERT en "cliente" usando la PK recién generada en "usuario" como FK compartida.
// Requiere: nombre_usuario, correo.
router.post('/',      verifyToken, clientesController.create);

// PUT /api/clientes/:id
// Actualiza nombre_usuario y/o correo. Como los datos del cliente están distribuidos
// en dos tablas, el servicio ejecuta un UPDATE en "usuario" y otro en "cliente"
// dentro de la misma transacción. Acepta actualización parcial: basta con enviar
// al menos uno de los dos campos.
router.put('/:id',    verifyToken, clientesController.update);

// DELETE /api/clientes/:id
// Elimina el cliente solo si no tiene pedidos externos asociados (verificación previa
// con COUNT). Si los tiene, el servicio lanza un error 409 Conflict. Si no, borra
// primero la fila de "cliente" y luego la de "usuario" en la misma transacción,
// respetando el orden requerido por las restricciones de FK.
router.delete('/:id', verifyToken, clientesController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/clientes".
module.exports = router;
