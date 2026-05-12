const { Router } = require('express');
const bodegasController = require('../controllers/bodegas.controller');
// verifyToken valida el JWT en el header Authorization antes de que la petición
// alcance el controlador. Se aplica a cada ruta para proteger todo el recurso /api/bodegas.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/bodegas
// Devuelve todas las bodegas ordenadas por id descendente (la más reciente primero).
// Incluye todos los campos de la tabla: descripcion, ubicacion, ciudad,
// capacidad_maxima, capacidad_actual, tipo_bodega, activa y usuario_trab_id_responsable.
router.get('/',       verifyToken, bodegasController.getAll);

// GET /api/bodegas/:id
// Devuelve una bodega específica por su PK (id_bodega). Responde 404 si no existe.
router.get('/:id',    verifyToken, bodegasController.getById);

// POST /api/bodegas
// Crea una nueva bodega. Campos obligatorios:
//   - descripcion:                nombre o etiqueta de la bodega.
//   - ubicacion:                  dirección física o referencia de localización.
//   - ciudad:                     ciudad donde se encuentra la bodega.
//   - capacidad_maxima:           límite total de unidades o volumen que puede almacenar.
//   - tipo_bodega:                ENUM en BD ('principal', 'secundaria', 'transito');
//                                 solo se aceptan esos tres valores exactos.
//   - usuario_trab_id_responsable: FK al trabajador responsable de la bodega.
// Campos opcionales con valor por defecto en el servicio:
//   - capacidad_actual:           unidades actualmente almacenadas (por defecto 0).
//   - activa:                     TINYINT(1) que indica si la bodega está operativa
//                                 (1 = activa, 0 = inactiva); por defecto 1 al crear.
router.post('/',      verifyToken, bodegasController.create);

// PUT /api/bodegas/:id
// Actualiza parcialmente una bodega: solo modifica los campos presentes en el body
// que estén en la lista blanca del servicio. Responde 404 si la bodega no existe.
// Permite, por ejemplo, cambiar solo el campo "activa" para desactivar una bodega
// sin necesidad de enviar todos los demás campos.
router.put('/:id',    verifyToken, bodegasController.update);

// DELETE /api/bodegas/:id
// Elimina la bodega por su PK. Responde 404 si no existía.
// Si tiene registros de inventario u otras entidades con FK hacia esta bodega y
// la restricción es ON DELETE RESTRICT, MySQL rechazará el DELETE con un error
// de integridad que el errorHandler global devolverá como 500.
router.delete('/:id', verifyToken, bodegasController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/bodegas".
module.exports = router;
