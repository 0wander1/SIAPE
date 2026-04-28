const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = [
  'descripcion',
  'ubicacion',
  'ciudad',
  'capacidad_maxima',
  'capacidad_actual',
  'tipo_bodega',
  'activa',
  'usuario_trab_id_responsable',
];

async function getAll() {
  const [rows] = await pool.query(
    'SELECT * FROM bodega ORDER BY id_bodega DESC'
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM bodega WHERE id_bodega = ?',
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    descripcion,
    ubicacion,
    ciudad,
    capacidad_maxima,
    capacidad_actual,
    tipo_bodega,
    activa,
    usuario_trab_id_responsable,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO bodega
      (descripcion, ubicacion, ciudad, capacidad_maxima, capacidad_actual,
       tipo_bodega, activa, usuario_trab_id_responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      descripcion,
      ubicacion,
      ciudad,
      capacidad_maxima,
      capacidad_actual ?? 0,
      tipo_bodega,
      activa ?? 1,
      usuario_trab_id_responsable,
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

  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE bodega SET ${setClause} WHERE id_bodega = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM bodega WHERE id_bodega = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
