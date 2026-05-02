const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = [
  'numero_factura',
  'fecha_emision',
  'fecha_vencimiento',
  'subtotal',
  'impuesto',
  'descuento',
  'estado',
  'usuario_trab_id',
  'pedido_id_pedido',
];

// total nunca viene del cliente, siempre se deriva
const CAMPOS_CALCULO = ['subtotal', 'impuesto', 'descuento'];

function calcularTotal(subtotal, impuesto, descuento) {
  return Number(subtotal) + Number(impuesto) - Number(descuento);
}

async function getAll() {
  const [rows] = await pool.query(
    'SELECT * FROM factura ORDER BY id_factura DESC'
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM factura WHERE id_factura = ?',
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    numero_factura,
    fecha_emision,
    fecha_vencimiento,
    subtotal,
    impuesto,
    descuento,
    estado,
    usuario_trab_id,
    pedido_id_pedido,
  } = data;

  const [existing] = await pool.query(
    'SELECT id_factura FROM factura WHERE pedido_id_pedido = ?',
    [pedido_id_pedido]
  );
  if (existing.length > 0) {
    throw Object.assign(
      new Error('Ya existe una factura para ese pedido'),
      { status: 409 }
    );
  }

  const total = calcularTotal(subtotal, impuesto ?? 0, descuento ?? 0);

  const [result] = await pool.query(
    `INSERT INTO factura
      (numero_factura, fecha_emision, fecha_vencimiento, subtotal, impuesto,
       descuento, total, estado, usuario_trab_id, pedido_id_pedido)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      numero_factura,
      fecha_emision,
      fecha_vencimiento ?? null,
      subtotal,
      impuesto ?? 0,
      descuento ?? 0,
      total,
      estado,
      usuario_trab_id,
      pedido_id_pedido,
    ]
  );

  return getById(result.insertId);
}

async function update(id, data) {
  let campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Si algún componente del total cambia, recalcular con los valores actuales como base
  const afectaTotal = CAMPOS_CALCULO.some((c) => campos.includes(c));
  if (afectaTotal) {
    const actual = await getById(id);
    if (!actual) return null;

    const subtotal  = data.subtotal  ?? actual.subtotal;
    const impuesto  = data.impuesto  ?? actual.impuesto;
    const descuento = data.descuento ?? actual.descuento;

    data  = { ...data, total: calcularTotal(subtotal, impuesto, descuento) };
    campos = [...campos, 'total'];
  }

  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE factura SET ${setClause} WHERE id_factura = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM factura WHERE id_factura = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
