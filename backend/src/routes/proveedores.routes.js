const { Router } = require('express');
const proveedoresController = require('../controllers/proveedores.controller');
// verifyToken valida el JWT en el header Authorization antes de que la petición
// alcance el controlador. Se aplica a cada ruta para proteger todo el recurso /api/proveedores.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/proveedores
// Devuelve todos los proveedores. Cada proveedor incluye un array "productos_asociados"
// construido a partir del JOIN con la tabla pivote "producto_has_proveedor".
// El servicio agrupa las filas planas del JOIN en objetos anidados antes de responder.
router.get('/',       verifyToken, proveedoresController.getAll);

// GET /api/proveedores/:id
// Devuelve un proveedor específico por su PK con su array de productos asociados.
// Responde 404 si el proveedor no existe.
router.get('/:id',    verifyToken, proveedoresController.getById);

// POST /api/proveedores
// Crea un nuevo proveedor. Antes de insertar, el servicio verifica que el NIT no esté
// ya registrado en la BD para mantener la unicidad del campo. Si el NIT existe,
// responde 409 Conflict; si no, inserta el registro y retorna el proveedor creado.
// Requiere: nombre_proveedor, NIT, id_usuario_trab.
router.post('/',      verifyToken, proveedoresController.create);

// PUT /api/proveedores/:id
// Actualiza parcialmente un proveedor: solo modifica los campos presentes en el body
// que estén en la lista blanca del servicio (nombre_proveedor, NIT, id_usuario_trab).
// Si se intenta cambiar el NIT a uno ya existente, MySQL lanzará ER_DUP_ENTRY
// porque la columna tiene un índice UNIQUE; el servicio convierte ese error en 409.
router.put('/:id',    verifyToken, proveedoresController.update);

// DELETE /api/proveedores/:id
// Elimina el proveedor por su PK. Si tiene filas dependientes en "producto_has_proveedor"
// y la FK tiene ON DELETE RESTRICT, MySQL lanzará un error que el errorHandler global
// capturará y devolverá como 500. Responde 404 si el proveedor no existía.
router.delete('/:id', verifyToken, proveedoresController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/proveedores".
module.exports = router;
