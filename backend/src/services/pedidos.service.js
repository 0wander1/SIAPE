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

const SQL_SELECT = `
  SELECT
    pe.id_pedido          AS id,
    u.nombre_usuario      AS cliente,
    p.nombre_producto     AS producto,
    pe.cantidad,
    pe.estado,
    pe.valor_total        AS valorTotal,
    pe.direccion_pedido   AS direccion,
    pe.fecha_entrega_estimada AS fechaEstimada,
    pe.fecha_entrega_real     AS fechaReal,
    pe.observaciones
  FROM pedido_externo pe
  LEFT JOIN cliente    c ON pe.cliente_id_usuario_cli = c.id_usuario_cli
  LEFT JOIN usuario    u ON c.id_usuario_cli           = u.id_usuario
  LEFT JOIN producto   p ON pe.producto_id_producto    = p.id_producto
`;

async function getAll() {
  const [rows] = await pool.query(`${SQL_SELECT} ORDER BY pe.id_pedido DESC`);
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    `${SQL_SELECT} WHERE pe.id_pedido = ?`,
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
  } = data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tiempoResult] = await conn.query(
      `INSERT INTO tiempo
        (fecha_hora, anio, mes, semana, trimestre, dia_semana, es_fin_semana, es_festivo, dia)
       VALUES (NOW(), YEAR(NOW()), MONTH(NOW()), WEEK(NOW()), QUARTER(NOW()),
               DAYNAME(NOW()), DAYOFWEEK(NOW()) IN (1,7), 0, DAY(NOW()))`
    );

    const tiempo_id_tiempo = tiempoResult.insertId;

    const [pedidoResult] = await conn.query(
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
        tiempo_id_tiempo,
      ]
    );

    await conn.commit();
    return getById(pedidoResult.insertId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
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
