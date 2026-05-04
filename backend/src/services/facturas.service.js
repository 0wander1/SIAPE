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
    productos,
  } = data;

  const pedidoId = pedido_id_pedido || null;

  if (!pedidoId) {
    if (!Array.isArray(productos) || productos.length === 0) {
      throw Object.assign(
        new Error('Para venta directa se requiere al menos un producto'),
        { status: 400 }
      );
    }
    for (const item of productos) {
      if (!item.producto_id_producto || !item.cantidad || Number(item.cantidad) < 1) {
        throw Object.assign(
          new Error('Cada producto requiere producto_id_producto y cantidad válida'),
          { status: 400 }
        );
      }
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (pedidoId) {
      const [existing] = await conn.query(
        'SELECT id_factura FROM factura WHERE pedido_id_pedido = ?',
        [pedidoId]
      );
      if (existing.length > 0) {
        throw Object.assign(
          new Error('Ya existe una factura para ese pedido'),
          { status: 409 }
        );
      }
    } else {
      for (const item of productos) {
        const [invRows] = await conn.query(
          'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? FOR UPDATE',
          [item.producto_id_producto]
        );
        if (invRows.length === 0) {
          throw Object.assign(
            new Error(`Producto ${item.producto_id_producto} no encontrado en inventario`),
            { status: 404 }
          );
        }
        if (invRows[0].cantidad_disponible - Number(item.cantidad) < 0) {
          throw Object.assign(
            new Error(`Stock insuficiente para el producto ${item.producto_id_producto}`),
            { status: 400 }
          );
        }
        await conn.query(
          'UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE producto_id_producto = ?',
          [Number(item.cantidad), item.producto_id_producto]
        );
      }
    }

    const total = calcularTotal(subtotal, impuesto ?? 0, descuento ?? 0);

    const [result] = await conn.query(
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
        pedidoId,
      ]
    );

    const facturaId = result.insertId;

    if (!pedidoId) {
      const itemValues = productos.map((item) => [
        facturaId,
        item.producto_id_producto,
        Number(item.cantidad),
        Number(item.valor_unitario) || 0,
      ]);
      await conn.query(
        'INSERT INTO factura_item (factura_id_factura, producto_id_producto, cantidad, valor_unitario) VALUES ?',
        [itemValues]
      );
    }

    await conn.commit();
    return getById(facturaId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
