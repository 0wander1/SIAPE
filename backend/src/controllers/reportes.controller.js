const reportesService = require('../services/reportes.service');

async function getReporteVentas(req, res, next) {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        message: 'Los parámetros fecha_inicio y fecha_fin son requeridos (formato: YYYY-MM-DD).',
      });
    }

    if (fecha_inicio > fecha_fin) {
      return res.status(400).json({
        message: 'fecha_inicio no puede ser mayor que fecha_fin.',
      });
    }

    const reporte = await reportesService.getReporteVentas(fecha_inicio, fecha_fin);
    return res.status(200).json(reporte);
  } catch (error) {
    next(error);
  }
}

async function getReporteInventario(req, res, next) {
  try {
    const reporte = await reportesService.getReporteInventario();
    return res.status(200).json(reporte);
  } catch (error) {
    next(error);
  }
}

module.exports = { getReporteVentas, getReporteInventario };
