const { pool } = require('../config/db');

const CAMPOS_PERMITIDOS_UPDATE = ['nombre_proveedor', 'NIT', 'id_usuario_trab'];

// Agrupa filas planas del JOIN en objetos proveedor con array de productos
function agruparProductos(rows) {
  const mapa = new Map();

  for (const row of rows) {
    if (!mapa.has(row.id_proveedor)) {
      mapa.set(row.id_proveedor, {
        id_proveedor:      row.id_proveedor,
        nombre_proveedor:  row.nombre_proveedor,
        NIT:               row.NIT,
        id_usuario_trab:   row.id_usuario_trab,
        productos_asociados: [],
      });
    }

    // Solo agrega la relación si existe (LEFT JOIN puede devolver NULLs)
    if (row.id_prod_prov !== null) {
      mapa.get(row.id_proveedor).productos_asociados.push({
        id_prod_prov:            row.id_prod_prov,
        producto_id_producto:    row.producto_id_producto,
        precio_compra:           row.precio_compra,
        tiempo_entrega_dias:     row.tiempo_entrega_dias,
        es_proveedor_principal:  row.es_proveedor_principal,
        fecha_inicio_contrato:   row.fecha_inicio_contrato,
        fecha_fin_contrato:      row.fecha_fin_contrato,
        activo:                  row.activo,
      });
    }
  }

  return Array.from(mapa.values());
}

const SQL_JOIN = `
  SELECT
    p.id_proveedor,
    p.nombre_proveedor,
    p.NIT,
    p.id_usuario_trab,
    pp.id_prod_prov,
    pp.producto_id_producto,
    pp.precio_compra,
    pp.tiempo_entrega_dias,
    pp.es_proveedor_principal,
    pp.fecha_inicio_contrato,
    pp.fecha_fin_contrato,
    pp.activo
  FROM proveedor p
  LEFT JOIN producto_has_proveedor pp ON p.id_proveedor = pp.proveedor_id_proveedor
`;

async function getAll() {
  const [rows] = await pool.query(`${SQL_JOIN} ORDER BY p.id_proveedor DESC`);
  return agruparProductos(rows);
}

async function getById(id) {
  const [rows] = await pool.query(
    `${SQL_JOIN} WHERE p.id_proveedor = ?`,
    [id]
  );
  const resultado = agruparProductos(rows);
  return resultado[0] || null;
}

async function create(data) {
  const { nombre_proveedor, NIT, id_usuario_trab } = data;

  const [existing] = await pool.query(
    'SELECT id_proveedor FROM proveedor WHERE NIT = ?',
    [NIT]
  );
  if (existing.length > 0) {
    throw Object.assign(new Error('Ya existe un proveedor con ese NIT.'), { status: 409 });
  }

  const [result] = await pool.query(
    'INSERT INTO proveedor (nombre_proveedor, NIT, id_usuario_trab) VALUES (?, ?, ?)',
    [nombre_proveedor, NIT, id_usuario_trab]
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
  const valores = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE proveedor SET ${setClause} WHERE id_proveedor = ?`,
    [...valores, id]
  );

  if (result.affectedRows === 0) return null;
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM proveedor WHERE id_proveedor = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
