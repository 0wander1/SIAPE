const { pool } = require('../config/db');

// Plantilla SQL reutilizada por getAll y getById.
// LEFT JOIN en proveedor y usuario_trab para que un pedido cuya FK esté rota
// igualmente aparezca en los resultados, con los campos de la tabla unida como null.
const SQL_SELECT = `
  SELECT
    pp.id_pedido_prov,
    pp.proveedor_id_proveedor,
    pp.usuario_trab_id,
    pp.fecha_creacion,
    pp.fecha_estimada  AS fechaEstimada,
    pp.estado,
    pp.valor_total             AS valorTotal,
    pp.observaciones,
    p.nombre_proveedor,
    p.NIT,
    ut.user_name               AS trabajador
  FROM pedido_proveedor pp
  LEFT JOIN proveedor    p  ON pp.proveedor_id_proveedor = p.id_proveedor
  LEFT JOIN usuario_trab ut ON pp.usuario_trab_id        = ut.id_usuario_trab
`;

// Ejecuta un único query de items para todos los ids recibidos usando IN,
// evitando el problema N+1 que ocurriría si se consultara item por item.
// Devuelve un Map<id_pedido_prov, items[]> para que el llamador pueda asignar
// los items a cada pedido en O(1) sin iterar el array completo por cada pedido.
async function cargarItems(ids) {
  if (ids.length === 0) return new Map();

  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT
       i.id_item,
       i.pedido_prov_id,
       i.producto_id_producto,
       i.cantidad,
       i.precio_unitario,
       p.nombre_producto
     FROM pedido_proveedor_item i
     LEFT JOIN producto p ON i.producto_id_producto = p.id_producto
     WHERE i.pedido_prov_id IN (${placeholders})`,
    ids
  );

  const mapa = new Map();
  for (const row of rows) {
    const key = row.pedido_prov_id;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push({
      id_item:  row.id_item,
      producto_id_producto: row.producto_id_producto,
      nombre_producto:      row.nombre_producto,
      cantidad:             row.cantidad,
      precio_unitario:      row.precio_unitario,
    });
  }
  return mapa;
}

// Retorna todos los pedidos a proveedor con su proveedor, trabajador e items.
// El segundo query carga todos los items de una vez usando IN para evitar N+1.
async function getAll() {
  const [rows] = await pool.query(`${SQL_SELECT} ORDER BY pp.id_pedido_prov DESC`);
  if (rows.length === 0) return [];

  const ids      = rows.map((r) => r.id_pedido_prov);
  const itemsMap = await cargarItems(ids);

  return rows.map((r) => ({
    ...r,
    items: itemsMap.get(r.id_pedido_prov) ?? [],
  }));
}

// Retorna un único pedido a proveedor filtrando por PK.
// rows[0] es undefined si no existe; || null garantiza null explícito para 404.
async function getById(id) {
  const [rows] = await pool.query(
    `${SQL_SELECT} WHERE pp.id_pedido_prov = ?`,
    [id]
  );
  if (!rows[0]) return null;

  const itemsMap = await cargarItems([id]);
  return {
    ...rows[0],
    items: itemsMap.get(rows[0].id_pedido_prov) ?? [],
  };
}

// Crea un pedido a proveedor con sus items usando una transacción.
// Si cualquiera de los INSERTs falla el rollback garantiza que no quede
// un pedido sin items ni items sin pedido padre en la BD.
async function create(data) {
  const {
    proveedor_id_proveedor,
    usuario_trab_id,
    estado,
    valor_total,
    fecha_estimada,
    observaciones,
    items = [],
  } = data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [pedidoResult] = await conn.query(
      `INSERT INTO pedido_proveedor
        (proveedor_id_proveedor, usuario_trab_id, estado, valor_total,
         fecha_estimada, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        proveedor_id_proveedor,
        usuario_trab_id,
        estado,
        valor_total,
        fecha_estimada ?? null,
        observaciones  ?? null,
      ]
    );

    const id_pedido_prov = pedidoResult.insertId;

    // Inserta cada item vinculándolo al pedido recién creado.
    // Se itera con for...of en lugar de Promise.all para mantener el orden de inserción
    // y que todos los queries corran dentro de la misma conexión transaccional.
    for (const item of items) {
      await conn.query(
        `INSERT INTO pedido_proveedor_item
          (pedido_prov_id, producto_id_producto, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?)`,
        [
          id_pedido_prov,
          item.producto_id_producto,
          item.cantidad,
          item.precio_unitario,
        ]
      );

      // Actualiza el precio de compra en la tabla pivote para reflejar el precio
      // negociado en este pedido. Si la relación producto-proveedor no existe en
      // producto_has_proveedor el UPDATE no afecta filas y se ignora silenciosamente.
      await conn.query(
        `UPDATE producto_has_proveedor
            SET precio_compra = ?
          WHERE producto_id_producto   = ?
            AND proveedor_id_proveedor = ?`,
        [item.precio_unitario, item.producto_id_producto, proveedor_id_proveedor]
      );

      await conn.query(
        `UPDATE producto SET valor_neto = ? WHERE id_producto = ?`,
        [item.precio_unitario, item.producto_id_producto]
      );
    }

    await conn.commit();
    return getById(id_pedido_prov);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

const CAMPOS_PERMITIDOS_UPDATE = [
  'proveedor_id_proveedor',
  'usuario_trab_id',
  'estado',
  'valor_total',
  'fecha_estimada',
  'observaciones',
];

// Actualiza los campos del pedido.
// Cuando el estado cambia a 'recibido' se abre una transacción que engloba tanto el UPDATE
// del pedido como los incrementos de inventario, de forma que si cualquier UPDATE de
// inventario falla el cambio de estado también se revierte y no queda stock inconsistente.
async function update(id, data) {
  const { bodega_id } = data;
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  const setClauses = campos.map((c) => `${c} = ?`);
  const valores    = campos.map((c) => data[c]);

  if (data.estado !== 'recibido') {
    const [result] = await pool.query(
      `UPDATE pedido_proveedor SET ${setClauses.join(', ')} WHERE id_pedido_prov = ?`,
      [...valores, id]
    );
    if (result.affectedRows === 0) return null;
    return getById(id);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[pedidoActual]] = await conn.query(
      'SELECT estado FROM pedido_proveedor WHERE id_pedido_prov = ?',
      [id]
    );
    if (pedidoActual?.estado === 'recibido') {
      throw Object.assign(
        new Error('El pedido ya fue recibido anteriormente.'),
        { status: 409 }
      );
    }

    const [result] = await conn.query(
      `UPDATE pedido_proveedor SET ${setClauses.join(', ')} WHERE id_pedido_prov = ?`,
      [...valores, id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return null;
    }

    const [items] = await conn.query(
      'SELECT producto_id_producto, cantidad FROM pedido_proveedor_item WHERE pedido_prov_id = ?',
      [id]
    );

    for (const item of items) {
      await conn.query(
        `INSERT INTO inventario (producto_id_producto, bodega_id_bodega, cantidad_disponible, cantidad_reservada, cantidad_minima, ultima_actualizacion)
         VALUES (?, ?, ?, 0, 0, NOW())
         ON DUPLICATE KEY UPDATE
           cantidad_disponible  = cantidad_disponible + VALUES(cantidad_disponible),
           ultima_actualizacion = NOW()`,
        [item.producto_id_producto, bodega_id, item.cantidad]
      );
    }

    await conn.commit();
    return getById(id);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const [[pedido]] = await pool.query(
    'SELECT estado FROM pedido_proveedor WHERE id_pedido_prov = ?',
    [id]
  );

  if (!pedido) return null;

  if (pedido.estado === 'recibido') {
    throw Object.assign(
      new Error('No se puede eliminar un pedido ya recibido'),
      { status: 409 }
    );
  }

  await pool.query('DELETE FROM pedido_proveedor WHERE id_pedido_prov = ?', [id]);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
