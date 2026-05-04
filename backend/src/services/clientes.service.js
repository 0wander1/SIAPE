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
  const { nombre_usuario, correo } = data;

  if (nombre_usuario === undefined && correo === undefined) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (nombre_usuario !== undefined) {
      await conn.query(
        'UPDATE usuario SET nombre_usuario = ? WHERE id_usuario = ?',
        [nombre_usuario, id]
      );
    }

    if (correo !== undefined) {
      await conn.query(
        'UPDATE cliente SET correo = ? WHERE id_usuario_cli = ?',
        [correo, id]
      );
    }

    await conn.commit();
    return getById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM pedido_externo WHERE cliente_id_usuario_cli = ?',
    [id]
  );

  if (count > 0) {
    throw Object.assign(
      new Error('No se puede eliminar el cliente porque tiene pedidos asociados'),
      { status: 409 }
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM cliente WHERE id_usuario_cli = ?', [id]);
    const [result] = await conn.query('DELETE FROM usuario WHERE id_usuario = ?', [id]);
    await conn.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getAll, getById, create, update, remove };
