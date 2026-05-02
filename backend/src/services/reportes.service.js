const { pool } = require('../config/db');

async function getReporteVentas(fechaInicio, fechaFin) {
  const [[resumen]] = await pool.query(
    `SELECT
       COUNT(*)                      AS total_facturas,
       COALESCE(SUM(total), 0)       AS ingresos_totales,
       COALESCE(AVG(total), 0)       AS promedio_por_factura
     FROM factura
     WHERE fecha_emision BETWEEN ? AND ?
       AND estado <> 'anulada'`,
    [fechaInicio, fechaFin]
  );

  const [porSemana] = await pool.query(
    `SELECT
       YEARWEEK(fecha_emision, 1)                        AS semana,
       DATE_FORMAT(MIN(fecha_emision), '%Y-%m-%d')        AS inicio_semana,
       COUNT(*)                                           AS total_facturas,
       COALESCE(SUM(total), 0)                            AS ingresos
     FROM factura
     WHERE fecha_emision BETWEEN ? AND ?
       AND estado <> 'anulada'
     GROUP BY YEARWEEK(fecha_emision, 1)
     ORDER BY semana ASC`,
    [fechaInicio, fechaFin]
  );

  return {
    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    resumen,
    por_semana: porSemana,
  };
}

async function getReporteInventario() {
  const [productos] = await pool.query(
    `SELECT
       i.id_inventario,
       i.cantidad_disponible,
       i.cantidad_reservada,
       i.cantidad_minima,
       i.ultima_actualizacion,
       i.producto_id_producto,
       i.bodega_id_bodega,
       p.nombre_producto,
       b.descripcion  AS descripcion_bodega,
       b.ciudad       AS ciudad_bodega
     FROM inventario i
     JOIN producto p ON i.producto_id_producto = p.id_producto
     JOIN bodega   b ON i.bodega_id_bodega     = b.id_bodega
     WHERE i.cantidad_disponible < i.cantidad_minima
     ORDER BY i.cantidad_disponible ASC`
  );

  return {
    total_criticos: productos.length,
    productos,
  };
}

module.exports = { getReporteVentas, getReporteInventario };
