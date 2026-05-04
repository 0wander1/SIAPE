const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = [
  'cantidad_disponible',
  'cantidad_reservada',
  'cantidad_minima',
  'producto_id_producto',
  'bodega_id_bodega',
];

async function getAll() {
  const [rows] = await pool.query(
    `SELECT
       i.id_inventario,
       i.cantidad_disponible,
       i.cantidad_reservada,
       i.cantidad_minima,
       i.ultima_actualizacion,
       i.producto_id_producto,
       i.bodega_id_bodega,
       p.nombre_producto,
       b.descripcion AS descripcion_bodega
     FROM inventario i
     LEFT JOIN producto p ON i.producto_id_producto = p.id_producto
     LEFT JOIN bodega b   ON i.bodega_id_bodega = b.id_bodega
     ORDER BY i.id_inventario DESC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM inventario WHERE id_inventario = ?',
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    cantidad_disponible,
    cantidad_reservada,
    cantidad_minima,
    producto_id_producto,
    bodega_id_bodega,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO inventario
      (cantidad_disponible, cantidad_reservada, cantidad_minima,
       producto_id_producto, bodega_id_bodega, ultima_actualizacion)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [
      cantidad_disponible,
      cantidad_reservada ?? 0,
      cantidad_minima ?? 0,
      producto_id_producto,
      bodega_id_bodega,
    ]
  );

  return getById(result.insertId);
}

async function update(id, data) {
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  const setClause = [...campos.map((c) => `${c} = ?`), 'ultima_actualizacion = NOW()'].join(', ');
  const valores = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE inventario SET ${setClause} WHERE id_inventario = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM inventario WHERE id_inventario = ?',
    [id]
  );
  return result.affectedRows > 0;
}

async function cargaMasiva(filas) {
  let creados = 0;
  let actualizados = 0;
  const errores = [];

  const conn = await pool.getConnection();
  try {
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const nombre_producto     = fila.nombre_producto;
      const bodega_id_bodega    = Number(fila.bodega_id_bodega);
      const cantidad_disponible = Number(fila.cantidad_disponible) || 0;
      const cantidad_reservada  = Number(fila.cantidad_reservada)  || 0;
      const cantidad_minima     = Number(fila.cantidad_minima)     || 0;
      const _valor_neto        = fila.valor_neto        ?? fila['valor_neto (opcional)'];
      const _valor_de_venta    = fila.valor_de_venta    ?? fila['valor_de_venta (opcional)'];
      const _lote              = fila.lote              ?? fila['lote (opcional)'];
      const _fecha_vencimiento = fila.fecha_vencimiento ?? fila['fecha_vencimiento (opcional)'];
      const valor_neto          = _valor_neto        != null ? Number(_valor_neto)       : 0;
      const valor_de_venta      = _valor_de_venta    != null ? Number(_valor_de_venta)   : 0;
      const lote                = _lote              != null ? String(_lote)             : null;
      const fecha_vencimiento   = _fecha_vencimiento == null
        ? null
        : typeof _fecha_vencimiento === 'number'
          ? new Date(Math.round((_fecha_vencimiento - 25569) * 86400 * 1000)).toISOString().split('T')[0]
          : String(_fecha_vencimiento);

      if (!nombre_producto || !bodega_id_bodega) {
        errores.push(`Fila ${i + 2}: nombre_producto y bodega_id_bodega son requeridos.`);
        continue;
      }

      try {
        await conn.beginTransaction();

        // 1. Buscar o crear el producto por nombre (valores mínimos si es nuevo)
        const [[productoExistente]] = await conn.query(
          'SELECT id_producto FROM producto WHERE nombre_producto = ?',
          [nombre_producto]
        );

        let producto_id_producto;
        if (productoExistente) {
          producto_id_producto = productoExistente.id_producto;
        } else {
          const [prodResult] = await conn.query(
            `INSERT INTO producto
               (nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega]
          );
          producto_id_producto = prodResult.insertId;
        }

        // 2. Buscar o actualizar/crear el registro de inventario
        const [[invExistente]] = await conn.query(
          'SELECT id_inventario FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
          [producto_id_producto, bodega_id_bodega]
        );

        if (invExistente) {
          await conn.query(
            `UPDATE inventario SET
               cantidad_disponible  = ?,
               cantidad_reservada   = ?,
               cantidad_minima      = ?,
               ultima_actualizacion = NOW()
             WHERE id_inventario = ?`,
            [cantidad_disponible, cantidad_reservada, cantidad_minima, invExistente.id_inventario]
          );
          actualizados++;
        } else {
          await conn.query(
            `INSERT INTO inventario
               (cantidad_disponible, cantidad_reservada, cantidad_minima,
                producto_id_producto, bodega_id_bodega, ultima_actualizacion)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [cantidad_disponible, cantidad_reservada, cantidad_minima, producto_id_producto, bodega_id_bodega]
          );
          creados++;
        }

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        errores.push(`Fila ${i + 2}: ${err.message}`);
      }
    }
  } finally {
    conn.release();
  }

  return { creados, actualizados, errores };
}

module.exports = { getAll, getById, create, update, remove, cargaMasiva };
