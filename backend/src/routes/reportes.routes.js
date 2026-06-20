const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
// verifyToken protege los reportes: son información financiera y operativa sensible
// que solo usuarios autenticados del sistema pueden consultar.
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/reportes/ventas?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
// Reporte de ventas dentro de un rango de fechas. Devuelve dos niveles de datos:
//   1. "resumen": totales globales del período (facturas emitidas, ingresos y ticket promedio).
//   2. "por_semana": los mismos totales desglosados semana a semana usando YEARWEEK,
//      útil para detectar tendencias y picos de venta dentro del período consultado.
// Los parámetros se envían como query string, no como segmento de URL, porque son
// filtros opcionales de búsqueda y no identificadores de un recurso concreto.
// Ejemplo: /api/reportes/ventas?fecha_inicio=2025-01-01&fecha_fin=2025-03-31
// El controlador valida que ambas fechas estén presentes y que fecha_inicio <= fecha_fin.
// Las facturas anuladas se excluyen siempre para no distorsionar las métricas de ventas.
router.get('/ventas',     verifyToken, reportesController.getReporteVentas);

// GET /api/reportes/inventario
// Reporte de stock crítico: devuelve todos los productos cuya cantidad_disponible
// es estrictamente menor que su cantidad_minima configurada, ordenados de menor a
// mayor disponibilidad para priorizar los más urgentes de reabastecer.
// No requiere parámetros porque el criterio de criticidad está definido en la BD
// (cantidad_disponible < cantidad_minima) y se aplica al inventario completo.
router.get('/inventario',  verifyToken, reportesController.getReporteInventario);

// GET /api/reportes/proveedores
// Retorna todos los proveedores con su conteo de productos asociados y pedidos totales.
router.get('/proveedores',  verifyToken, reportesController.getReporteProveedores);

// GET /api/reportes/trabajadores
// Retorna todos los trabajadores con sus datos públicos (id, nombre, cargo, turno,
// celular y correo), ordenados por cargo. No expone password_hash ni salt en ningún
// campo. No requiere parámetros: el reporte abarca la totalidad del personal registrado.
router.get('/trabajadores', verifyToken, reportesController.getReporteTrabajadores);

// GET /api/reportes/costos?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
// Reporte de costos de pedidos a proveedor en el rango de fechas indicado.
// Excluye pedidos cancelados. Devuelve resumen global y listado de pedidos con proveedor.
router.get('/costos',      verifyToken, reportesController.getReporteCostos);

// Se exporta el router para que src/routes/index.js lo monte bajo el prefijo "/reportes".
module.exports = router;
