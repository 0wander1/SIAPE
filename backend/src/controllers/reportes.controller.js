// El controlador valida los parámetros de entrada y delega la construcción
// del reporte al servicio. No contiene lógica SQL ni cálculos de agregación.
const reportesService = require('../services/reportes.service');

// Genera el reporte de ventas para el rango de fechas indicado en la query string.
async function getReporteVentas(req, res, next) {
  try {
    // Los parámetros llegan en req.query porque van en la URL como query string
    // (?fecha_inicio=...&fecha_fin=...), no como segmento de ruta.
    // req.query devuelve siempre strings; las fechas en formato YYYY-MM-DD son
    // comparables lexicográficamente con > porque ese formato es lexicográficamente
    // ordenable (año → mes → día), lo que permite la validación de rango sin parsear.
    const { fecha_inicio, fecha_fin } = req.query;

    // Validación de presencia: ambas fechas son obligatorias para acotar el período.
    // Sin ellas la consulta devolvería todos los datos históricos, lo que podría ser
    // muy costoso en una BD con muchos años de facturas.
    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        message: 'Los parámetros fecha_inicio y fecha_fin son requeridos (formato: YYYY-MM-DD).',
      });
    }

    // Validación de coherencia del rango: fecha_inicio no puede ser posterior a fecha_fin.
    // La comparación > funciona correctamente con strings YYYY-MM-DD porque el formato
    // ISO 8601 es lexicográficamente ordenable: '2025-12-01' > '2025-03-15' es true.
    // Detectar este error aquí evita una consulta SQL que devolvería 0 filas sin explicación.
    if (fecha_inicio > fecha_fin) {
      return res.status(400).json({
        message: 'fecha_inicio no puede ser mayor que fecha_fin.',
      });
    }

    // Se delegan las fechas validadas al servicio, que ejecutará las dos consultas
    // SQL (resumen global y desglose semanal) y devolverá el objeto de reporte completo.
    const reporte = await reportesService.getReporteVentas(fecha_inicio, fecha_fin);
    return res.status(200).json(reporte);
  } catch (error) {
    next(error);
  }
}

// Genera el reporte de stock crítico. No requiere parámetros: el criterio de
// criticidad (cantidad_disponible < cantidad_minima) se aplica al inventario completo.
// Un array vacío en "productos" es una respuesta válida: significa que ningún producto
// está en situación crítica, lo cual es el estado deseable del inventario.
async function getReporteInventario(req, res, next) {
  try {
    const reporte = await reportesService.getReporteInventario();
    return res.status(200).json(reporte);
  } catch (error) {
    next(error);
  }
}

module.exports = { getReporteVentas, getReporteInventario };
