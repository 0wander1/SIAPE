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
  const { nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega } = data;

  const [result] = await pool.query(
    `INSERT INTO producto
      (nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre_producto, valor_neto, valor_de_venta, lote ?? null, fecha_vencimiento ?? null, bodega_id_bodega]
  );

  return getById(result.insertId);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM producto WHERE id_producto = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, remove };
