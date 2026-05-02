const { pool } = require('../config/db');

async function getAll() {
  const [rows] = await pool.query(
    `SELECT id_producto, nombre_producto, valor_neto, valor_de_venta,
            lote, fecha_vencimiento, bodega_id_bodega
     FROM producto
     ORDER BY nombre_producto ASC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT id_producto, nombre_producto, valor_neto, valor_de_venta,
            lote, fecha_vencimiento, bodega_id_bodega
     FROM producto WHERE id_producto = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento,
    bodega_id_bodega, cantidad, cantidad_minima,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO producto
      (nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre_producto, valor_neto, valor_de_venta, lote ?? null, fecha_vencimiento ?? null, bodega_id_bodega]
  );

  await pool.query(
    `INSERT INTO inventario
      (cantidad_disponible, cantidad_reservada, cantidad_minima,
       producto_id_producto, bodega_id_bodega, ultima_actualizacion)
     VALUES (?, 0, ?, ?, ?, NOW())`,
    [Number(cantidad) || 0, Number(cantidad_minima) || 0, result.insertId, bodega_id_bodega]
  );

  return getById(result.insertId);
}

async function remove(id) {
  const [[pedido]] = await pool.query(
    'SELECT id_pedido FROM pedido_externo WHERE producto_id_producto = ? LIMIT 1',
    [id]
  );
  if (pedido) {
    throw Object.assign(
      new Error('No se puede eliminar el producto porque tiene pedidos asociados'),
      { status: 409 }
    );
  }

  const [result] = await pool.query(
    'DELETE FROM producto WHERE id_producto = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, remove };
