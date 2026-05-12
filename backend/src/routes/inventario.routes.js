const { Router } = require('express');
const inventarioController = require('../controllers/inventario.controller');
// verifyToken valida el JWT en el header Authorization antes de permitir el acceso.
// Se aplica a cada ruta individualmente para proteger todo el recurso /api/inventario.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/inventario
// Devuelve todos los registros de inventario con nombre de producto y bodega resueltos
// mediante JOINs. Útil para mostrar el listado completo en el panel de administración.
router.get('/',                  verifyToken, inventarioController.getAll);

// GET /api/inventario/:id
// Devuelve un registro de inventario específico por su PK. Responde 404 si no existe.
router.get('/:id',               verifyToken, inventarioController.getById);

// POST /api/inventario
// Crea un único registro de inventario a partir del cuerpo JSON. Requiere los campos
// cantidad_disponible, producto_id_producto y bodega_id_bodega como mínimo.
router.post('/',                 verifyToken, inventarioController.create);

// POST /api/inventario/carga-masiva
// IMPORTANTE: esta ruta debe declararse ANTES de "/:id" para que Express no interprete
// la cadena "carga-masiva" como un valor del parámetro dinámico :id.
// Recibe un array JSON de filas exportadas desde Excel. Por cada fila busca el producto
// por nombre (creándolo si no existe) y luego inserta o actualiza el registro de inventario
// para la combinación producto + bodega. Devuelve un resumen con creados, actualizados y errores.
router.post('/carga-masiva',     verifyToken, inventarioController.cargaMasiva);

// PUT /api/inventario/:id
// Actualiza uno o varios campos del registro identificado por :id. Solo se modifican
// los campos presentes en el body que estén en la lista blanca del servicio.
// ultima_actualizacion se establece automáticamente a NOW() en cada actualización.
router.put('/:id',               verifyToken, inventarioController.update);

// DELETE /api/inventario/:id
// Elimina el registro de inventario. Responde 404 si no existe ningún registro con ese id.
router.delete('/:id',            verifyToken, inventarioController.remove);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/inventario".
module.exports = router;
