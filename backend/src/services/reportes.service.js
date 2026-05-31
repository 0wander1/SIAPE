const { pool } = require('../config/db');

// Genera el reporte de ventas para el período indicado mediante dos consultas independientes:
//   1. Resumen global: métricas agregadas de todo el período en una sola fila.
//   2. Desglose semanal: las mismas métricas agrupadas semana a semana.
// Ambas consultas aplican el mismo filtro de fechas y excluyen facturas anuladas.
async function getReporteVentas(fechaInicio, fechaFin, agrupacion = 'semana') {

  // --- Consulta 1: Resumen global del período ---
  // Las tres funciones de agregación operan sobre el mismo conjunto de filas
  // filtrado por BETWEEN y el estado, produciendo una única fila de resultado:
  //
  //   COUNT(*): cuenta todas las facturas del período, incluyendo las que tienen
  //     total = 0 (si las hubiera). No necesita COALESCE porque COUNT siempre
  //     retorna un número, incluso si el conjunto está vacío (devuelve 0).
  //
  //   SUM(total): suma los importes de todas las facturas. COALESCE(..., 0) es
  //     necesario porque si no hay facturas en el período, SUM devuelve NULL
  //     en lugar de 0, lo que haría que el campo llegue al cliente como null.
  //
  //   AVG(total): calcula el importe medio por factura (ticket promedio). También
  //     devuelve NULL si el conjunto está vacío, de ahí el COALESCE.
  //
  //   BETWEEN ? AND ?: filtra facturas cuya fecha_emision esté dentro del rango
  //     inclusivo [fechaInicio, fechaFin]. Los "?" se sustituyen de forma segura.
  //
  //   AND estado <> 'anulada': excluye facturas anuladas porque representan
  //     operaciones canceladas que nunca generaron ingreso real. Incluirlas
  //     inflaría artificialmente el COUNT y el SUM, distorsionando las métricas
  //     de rendimiento del negocio. Las facturas en otros estados (pendiente,
  //     parcial, pagada) sí se incluyen para reflejar toda la actividad comercial.
  //
  // La doble desestructuración [[resumen]] extrae directamente el objeto de la
  // primera fila: pool.query() → [rows] → rows[0] → objeto con los tres campos.
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

  // --- Consulta 2: Desglose semanal ---
  // Aplica el mismo filtro que la consulta 1 pero agrega GROUP BY YEARWEEK
  // para producir una fila por cada semana calendario del período.
  //
  //   YEARWEEK(fecha_emision, 1): genera un número entero en formato YYYYWW
  //     que identifica unívocamente cada semana del año (p. ej. 202503 = semana 3 de 2025).
  //     El segundo argumento "1" especifica que la semana comienza en LUNES (modo ISO 8601),
  //     que es el estándar internacional. Sin este argumento el modo por defecto en MySQL
  //     puede variar según la configuración del servidor (algunas versiones empiezan en domingo).
  //     Este valor entero se usa en GROUP BY para agrupar todas las facturas de la misma
  //     semana y en ORDER BY para ordenar los grupos cronológicamente.
  //
  //   DATE_FORMAT(MIN(fecha_emision), '%Y-%m-%d') AS inicio_semana: calcula la fecha
  //     real del primer día con facturas dentro de cada semana. Se usa MIN() porque dentro
  //     del grupo (una semana) puede haber varias fechas; MIN() toma la más temprana.
  //     Este campo es más legible para el front-end que el código numérico YYYYWW de YEARWEEK.
  //
  //   COUNT(*) y COALESCE(SUM(total), 0): mismas funciones que en el resumen global,
  //     pero aplicadas fila a fila dentro de cada grupo semanal.
  //
  //   GROUP BY YEARWEEK(fecha_emision, 1): agrupa todas las facturas de la misma semana
  //     ISO en una sola fila del resultado. Sin GROUP BY las funciones de agregación
  //     operarían sobre todas las filas del WHERE juntas (como en la consulta 1).
  //
  //   ORDER BY semana ASC: ordena los grupos de menor a mayor semana (cronológicamente),
  //     permitiendo al front-end dibujar un gráfico de barras o líneas en orden temporal.
  //
  // La simple desestructuración [porSemana] extrae el array completo de filas (una por semana).
  const esDia = agrupacion === 'dia';
  const [porSemana] = await pool.query(
    esDia
      ? `SELECT
           DATE_FORMAT(fecha_dia, '%Y-%m-%d') AS semana,
           COUNT(*)                     AS total_facturas,
           COALESCE(SUM(total), 0)      AS ingresos
         FROM (
           SELECT DATE(fecha_emision) AS fecha_dia, total
           FROM factura
           WHERE fecha_emision BETWEEN ? AND ?
             AND estado <> 'anulada'
         ) AS sub
         GROUP BY fecha_dia
         ORDER BY fecha_dia ASC`
      : `SELECT
           YEARWEEK(fecha_emision, 1)                       AS semana,
           DATE_FORMAT(MIN(fecha_emision), '%Y-%m-%d')       AS inicio_semana,
           COUNT(*)                                          AS total_facturas,
           COALESCE(SUM(total), 0)                           AS ingresos
         FROM factura
         WHERE fecha_emision BETWEEN ? AND ?
           AND estado <> 'anulada'
         GROUP BY YEARWEEK(fecha_emision, 1)
         ORDER BY semana ASC`,
    [fechaInicio, fechaFin]
  );

  // Se estructura la respuesta en tres secciones:
  //   "periodo":    eco de las fechas solicitadas para que el cliente confirme el rango.
  //   "resumen":    objeto único con los totales globales del período.
  //   "por_semana": array de objetos, uno por semana, con sus propios totales.
  return {
    periodo:    { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    resumen,
    por_semana: porSemana,
  };
}

// Genera el reporte de stock crítico: productos cuyo nivel de inventario ha caído
// por debajo del umbral mínimo configurado, indicando que necesitan reabastecimiento.
async function getReporteInventario() {

  // La consulta une tres tablas para enriquecer cada registro de inventario con el
  // nombre del producto y los datos de la bodega donde está almacenado.
  //
  //   JOIN (INNER JOIN) producto: se usa INNER JOIN en lugar de LEFT JOIN porque un
  //     registro de inventario sin producto asociado sería un dato corrupto que no
  //     debería aparecer en un reporte operativo. Si la FK está rota, el INNER JOIN
  //     lo excluye silenciosamente; un LEFT JOIN lo mostraría con nombre_producto = null.
  //
  //   JOIN (INNER JOIN) bodega: mismo razonamiento; todo inventario debe tener bodega.
  //
  //   WHERE i.cantidad_disponible < i.cantidad_minima: condición de stock crítico.
  //     cantidad_minima es el umbral de alerta configurado por bodega y producto;
  //     cuando la cantidad disponible cae por debajo de él, el producto aparece en este reporte.
  //     Se usa < estricto (no <=) para no incluir productos que estén exactamente en el mínimo,
  //     que se consideran aún dentro del margen de seguridad.
  //
  //   ORDER BY i.cantidad_disponible ASC: ordena de menor a mayor disponibilidad,
  //     colocando primero los productos más urgentes (los que tienen menos stock).
  //     Esto permite al usuario del reporte priorizar visualmente qué pedir primero.
  //
  //   Columnas seleccionadas:
  //     - cantidad_reservada: unidades apartadas para pedidos pendientes; útil para
  //       calcular el stock real disponible para nuevas ventas (disponible - reservada).
  //     - ultima_actualizacion: fecha del último movimiento de inventario; indica cuándo
  //       se registró por última vez una entrada o salida de ese producto en esa bodega.
  //     - ciudad_bodega: permite al usuario saber en qué ciudad física está el stock crítico.
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

  // Se devuelve el array de productos críticos junto con su conteo total.
  // "total_criticos" usa productos.length calculado en Node en lugar de COUNT(*) en SQL
  // porque el array ya está disponible; así se evita una tercera consulta a la BD.
  // Un valor de 0 en total_criticos indica que el inventario está saludable.
  return {
    total_criticos: productos.length,
    productos,
  };
}

async function getReporteProveedores() {
  const [proveedores] = await pool.query(
    `SELECT
       p.id_proveedor,
       p.nombre_proveedor,
       p.NIT,
       COUNT(DISTINCT php.producto_id_producto) AS total_productos,
       COUNT(DISTINCT pp.id_pedido_prov)        AS total_pedidos
     FROM proveedor p
     LEFT JOIN producto_has_proveedor php ON php.proveedor_id_proveedor = p.id_proveedor
     LEFT JOIN pedido_proveedor        pp  ON pp.proveedor_id_proveedor  = p.id_proveedor
     GROUP BY p.id_proveedor
     ORDER BY p.nombre_proveedor ASC`
  );
  return proveedores;
}

async function getReporteTrabajadores() {
  const [trabajadores] = await pool.query(
    `SELECT
       ut.id_usuario_trab,
       u.nombre_usuario AS nombre,
       ut.cargo,
       ut.turno,
       ut.celular,
       ut.correo
     FROM usuario_trab ut
     JOIN usuario u ON u.id_usuario = ut.id_usuario_trab
     ORDER BY ut.cargo ASC`
  );
  return trabajadores;
}

async function getReporteCostos(fechaInicio, fechaFin) {
  const [[resumen]] = await pool.query(
    `SELECT
       COUNT(*)                        AS total_pedidos,
       COALESCE(SUM(valor_total), 0)   AS costo_total,
       COALESCE(AVG(valor_total), 0)   AS promedio_por_pedido
     FROM pedido_proveedor
     WHERE fecha_creacion BETWEEN ? AND ?
       AND estado <> 'cancelado'`,
    [fechaInicio, fechaFin]
  );

  const [pedidos] = await pool.query(
    `SELECT
       pp.id_pedido_prov,
       pp.fecha_creacion,
       pp.fecha_estimada,
       pp.estado,
       pp.valor_total,
       pp.observaciones,
       p.nombre_proveedor,
       p.NIT
     FROM pedido_proveedor pp
     LEFT JOIN proveedor p ON pp.proveedor_id_proveedor = p.id_proveedor
     WHERE pp.fecha_creacion BETWEEN ? AND ?
       AND pp.estado <> 'cancelado'
     ORDER BY pp.fecha_creacion DESC`,
    [fechaInicio, fechaFin]
  );

  return { resumen, pedidos };
}

module.exports = { getReporteVentas, getReporteInventario, getReporteProveedores, getReporteTrabajadores, getReporteCostos };
