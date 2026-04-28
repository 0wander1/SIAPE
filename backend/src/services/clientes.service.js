const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = ['nombre_usuario', 'correo'];

async function getAll() {
  const [rows] = await pool.query(
    'SELECT * FROM cliente ORDER BY id_usuario_cli DESC'
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM cliente WHERE id_usuario_cli = ?',
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const { nombre_usuario, correo } = data;

  const [result] = await pool.query(
    'INSERT INTO cliente (nombre_usuario, correo) VALUES (?, ?)',
    [nombre_usuario, correo]
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
    `UPDATE cliente SET ${setClause} WHERE id_usuario_cli = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM cliente WHERE id_usuario_cli = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
