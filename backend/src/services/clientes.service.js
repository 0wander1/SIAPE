const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = ['nombre_usuario', 'correo'];

const SQL_SELECT = `
  SELECT c.id_usuario_cli, u.nombre_usuario, c.correo
  FROM cliente c
  INNER JOIN usuario u ON c.id_usuario_cli = u.id_usuario
`;

async function getAll() {
  const [rows] = await pool.query(`${SQL_SELECT} ORDER BY c.id_usuario_cli DESC`);
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(`${SQL_SELECT} WHERE c.id_usuario_cli = ?`, [id]);
  return rows[0] || null;
}

async function create(data) {
  const { nombre_usuario, correo } = data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [usuarioResult] = await conn.execute(
      'INSERT INTO usuario (nombre_usuario) VALUES (?)',
      [nombre_usuario]
    );
    const idUsuario = usuarioResult.insertId;

    await conn.execute(
      'INSERT INTO cliente (id_usuario_cli, correo) VALUES (?, ?)',
      [idUsuario, correo ?? null]
    );

    await conn.commit();
    return getById(idUsuario);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
