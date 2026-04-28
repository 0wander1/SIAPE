const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

async function findUserByUsername(userName) {
  const [rows] = await pool.query(
    'SELECT id_usuario_trab, user_name, password_hash, cargo FROM usuario_trab WHERE user_name = ?',
    [userName]
  );
  return rows[0] || null;
}

async function login(userName, password) {
  const user = await findUserByUsername(userName);

  // Mensaje genérico para no revelar si el usuario existe
  if (!user) {
    throw Object.assign(new Error('Credenciales incorrectas.'), { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw Object.assign(new Error('Credenciales incorrectas.'), { status: 401 });
  }

  const payload = {
    id: user.id_usuario_trab,
    user_name: user.user_name,
    cargo: user.cargo,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  return { token, user: payload };
}

module.exports = { login };
