const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = [
  'monto_pagado',
  'fecha_pago',
  'metodo_pago',
  'referencia_transaccion',
  'factura_id_factura',
  'usuario_trab_id_usuario_trab',
];

async function getAll() {
  const [rows] = await pool.query(
    `SELECT
       p.id_pago,
       p.monto_pagado,
       p.fecha_pago,
       p.metodo_pago,
       p.referencia_transaccion,
       p.factura_id_factura,
       p.usuario_trab_id_usuario_trab,
       f.numero_factura
     FROM pago p
     LEFT JOIN factura f ON p.factura_id_factura = f.id_factura
     ORDER BY p.id_pago DESC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM pago WHERE id_pago = ?',
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    monto_pagado,
    fecha_pago,
    metodo_pago,
    referencia_transaccion,
    factura_id_factura,
    usuario_trab_id_usuario_trab,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO pago
      (monto_pagado, fecha_pago, metodo_pago, referencia_transaccion,
       factura_id_factura, usuario_trab_id_usuario_trab)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      monto_pagado,
      fecha_pago,
      metodo_pago,
      referencia_transaccion ?? null,
      factura_id_factura,
      usuario_trab_id_usuario_trab,
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
  const valores   = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE pago SET ${setClause} WHERE id_pago = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM pago WHERE id_pago = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
