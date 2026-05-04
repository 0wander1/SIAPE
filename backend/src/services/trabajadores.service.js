const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Columnas seguras: nunca se exponen password_hash ni salt
const COLUMNAS_PUBLICAS = 'id_usuario_trab, cargo, direccion, turno, celular, user_name';

const CAMPOS_PERMITIDOS_UPDATE = ['cargo', 'direccion', 'turno', 'celular', 'user_name'];

async function getAll() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuario_trab ORDER BY id_usuario_trab DESC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuario_trab WHERE id_usuario_trab = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const { cargo, direccion, turno, celular, user_name, password } = data;

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [usuarioResult] = await conn.execute(
      'INSERT INTO usuario (nombre_usuario) VALUES (?)',
      [user_name]
    );
    const idUsuario = usuarioResult.insertId;

    await conn.execute(
      `INSERT INTO usuario_trab
        (id_usuario_trab, cargo, direccion, turno, celular, user_name, password_hash, salt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idUsuario, cargo, direccion ?? null, turno ?? null, celular ?? null, user_name, password_hash, salt]
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
  const { contrasena_actual, nueva_contrasena } = data;

  if (contrasena_actual !== undefined && nueva_contrasena !== undefined) {
    const [[row]] = await pool.query(
      'SELECT password_hash FROM usuario_trab WHERE id_usuario_trab = ?',
      [id]
    );

    if (!row) return null;

    const matches = await bcrypt.compare(contrasena_actual, row.password_hash);
    if (!matches) {
      throw Object.assign(
        new Error('La contraseña actual es incorrecta'),
        { status: 401 }
      );
    }

    const salt        = await bcrypt.genSalt(10);
    const newHash     = await bcrypt.hash(nueva_contrasena, salt);

    const [result] = await pool.query(
      'UPDATE usuario_trab SET password_hash = ?, salt = ? WHERE id_usuario_trab = ?',
      [newHash, salt, id]
    );

    if (result.affectedRows === 0) return null;
    return getById(id);
  }

  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE usuario_trab SET ${setClause} WHERE id_usuario_trab = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM usuario_trab WHERE id_usuario_trab = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
