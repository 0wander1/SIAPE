const { pool } = require('../config/db');

async function get() {
  const [rows] = await pool.query('SELECT * FROM negocio LIMIT 1');
  return rows[0] || null;
}

async function update(data) {
  const { nombre, nit, direccion, telefono, correo, logo_url } = data;
  const [result] = await pool.query(
    `UPDATE negocio
     SET nombre = ?, nit = ?, direccion = ?, telefono = ?, correo = ?, logo_url = ?
     WHERE id_negocio = 1`,
    [nombre, nit, direccion, telefono, correo, logo_url]
  );
  return result;
}

module.exports = { get, update };
