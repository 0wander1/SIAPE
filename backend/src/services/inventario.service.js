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
    'SELECT * FROM inventario ORDER BY id_inventario DESC'
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

module.exports = { getAll, getById, create, update, remove };
