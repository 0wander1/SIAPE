const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = [
  'cliente_id_usuario_cli',
  'producto_id_producto',
  'cantidad',
  'estado',
  'valor_total',
  'direccion_pedido',
  'fecha_entrega_estimada',
  'fecha_entrega_real',
  'observaciones',
  'usuario_trab_id',
  'tiempo_id_tiempo',
];

async function getAll() {
  const [rows] = await pool.query('SELECT * FROM pedido_externo ORDER BY id_pedido DESC');
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM pedido_externo WHERE id_pedido = ?',
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    cliente_id_usuario_cli,
    producto_id_producto,
    cantidad,
    estado,
    valor_total,
    direccion_pedido,
    fecha_entrega_estimada,
    fecha_entrega_real,
    observaciones,
    usuario_trab_id,
    tiempo_id_tiempo,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO pedido_externo
      (cliente_id_usuario_cli, producto_id_producto, cantidad, estado, valor_total,
       direccion_pedido, fecha_entrega_estimada, fecha_entrega_real, observaciones,
       usuario_trab_id, tiempo_id_tiempo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cliente_id_usuario_cli,
      producto_id_producto,
      cantidad,
      estado,
      valor_total,
      direccion_pedido,
      fecha_entrega_estimada ?? null,
      fecha_entrega_real ?? null,
      observaciones ?? null,
      usuario_trab_id,
      tiempo_id_tiempo ?? null,
    ]
  );

  return getById(result.insertId);
}

async function update(id, data) {
  // Construye el SET dinámicamente solo con los campos enviados
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(new Error('No se proporcionaron campos válidos para actualizar.'), { status: 400 });
  }

  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE pedido_externo SET ${setClause} WHERE id_pedido = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM pedido_externo WHERE id_pedido = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
