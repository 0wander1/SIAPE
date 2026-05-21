const { pool } = require('../config/db');

// Retorna todos los productos ordenados alfabéticamente por nombre.
// Se seleccionan solo las columnas necesarias para el listado; no se incluye
// información de inventario porque eso corresponde al recurso /api/inventario.
async function getAll() {
  const [rows] = await pool.query(
    `SELECT id_producto, nombre_producto, valor_neto, valor_de_venta,
            lote, fecha_vencimiento, bodega_id_bodega
     FROM producto
     ORDER BY nombre_producto ASC`
  );
  return rows;
}

// Retorna un único producto por PK. rows[0] es el primer resultado del array que
// devuelve pool.query(); si no hay filas, rows[0] es undefined y se retorna null
// para que el controlador lo convierta en una respuesta 404.
async function getById(id) {
  const [rows] = await pool.query(
    `SELECT id_producto, nombre_producto, valor_neto, valor_de_venta,
            lote, fecha_vencimiento, bodega_id_bodega
     FROM producto WHERE id_producto = ?`,
    [id]
  );
  return rows[0] || null;
}

// Crea un producto nuevo y, en la misma llamada, crea el registro de inventario
// inicial vinculado a ese producto y la bodega indicada. Ambas inserciones usan
// el mismo pool sin transacción explícita porque, si la segunda falla, el producto
// ya insertado puede corregirse manualmente; no se consideró un escenario crítico
// que requiera rollback automático como en el módulo de pedidos.
async function create(data) {
  const {
    nombre_producto,
    valor_neto,
    valor_de_venta,
    lote,
    fecha_vencimiento,
    bodega_id_bodega,
    cantidad,       // stock inicial que el usuario introduce al crear el producto
    cantidad_minima, // umbral de alerta de stock crítico
  } = data;

  // --- Primera inserción: tabla "producto" ---
  // lote y fecha_vencimiento son opcionales; ?? null convierte undefined en null
  // explícito para que MySQL los almacene como NULL y no falle el PreparedStatement.
  const [result] = await pool.query(
    `INSERT INTO producto
      (nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre_producto, valor_neto, valor_de_venta, lote ?? null, fecha_vencimiento ?? null, bodega_id_bodega]
  );

  // --- Segunda inserción: tabla "inventario" ---
  // Se crea automáticamente el registro de inventario para que el producto quede
  // vinculado a una bodega y con un stock inicial desde el momento de su creación,
  // evitando que existan productos sin representación en el inventario.
  //
  // result.insertId es la PK autogenerada por MySQL para el producto recién insertado;
  // se usa como FK en inventario (producto_id_producto).
  //
  // cantidad_reservada se fija en 0 literalmente: al crear el producto no hay
  // ninguna unidad apartada para pedidos aún.
  //
  // Number(cantidad) || 0 convierte el valor del body a número y usa 0 si no se envió
  // o si el valor no es numérico (NaN), garantizando que la columna nunca reciba NULL.
  // El mismo patrón aplica a cantidad_minima.
  await pool.query(
    `INSERT INTO inventario
      (cantidad_disponible, cantidad_reservada, cantidad_minima,
       producto_id_producto, bodega_id_bodega, ultima_actualizacion)
     VALUES (?, 0, ?, ?, ?, NOW())`,
    [Number(cantidad) || 0, Number(cantidad_minima) || 0, result.insertId, bodega_id_bodega]
  );

  // Se retorna el producto completo tal como quedó en BD usando la PK generada.
  return getById(result.insertId);
}

// Actualiza todos los campos de un producto existente. A diferencia del update de
// inventario (que construye el SET dinámicamente), aquí se actualiza la fila completa
// con una query fija porque el controlador ya validó que todos los campos obligatorios
// están presentes, por lo que siempre se dispone de todos los valores necesarios.
async function update(id, data) {
  const {
    nombre_producto,
    valor_neto,
    valor_de_venta,
    lote,
    fecha_vencimiento,
    bodega_id_bodega,
  } = data;

  // Number() convierte explícitamente los valores numéricos que podrían venir como
  // strings desde el body JSON (algunos clientes HTTP los envían así). Esto previene
  // que MySQL reciba strings donde espera DECIMAL o INT y descarte la actualización.
  // lote || null convierte la cadena vacía "" (campo borrado en el formulario) en NULL,
  // evitando que se guarde un string vacío donde el campo debería quedar sin valor.
  const [result] = await pool.query(
    `UPDATE producto SET
       nombre_producto   = ?,
       valor_neto        = ?,
       valor_de_venta    = ?,
       lote              = ?,
       fecha_vencimiento = ?,
       bodega_id_bodega  = ?
     WHERE id_producto = ?`,
    [
      nombre_producto,
      Number(valor_neto),
      Number(valor_de_venta),
      lote              || null,  // cadena vacía → NULL en BD
      fecha_vencimiento || null,  // cadena vacía → NULL en BD
      Number(bodega_id_bodega),
      id,
    ]
  );

  // affectedRows === 0 significa que el WHERE no coincidió con ninguna fila:
  // el producto con ese id no existe. El controlador convertirá null en 404.
  if (result.affectedRows === 0) return null;

  // Se retorna el producto con sus valores actualizados directamente desde BD
  // para garantizar que la respuesta refleja el estado real persistido.
  return getById(id);
}

// Elimina un producto verificando primero que no tenga pedidos externos asociados,
// para preservar la integridad referencial entre las tablas producto y pedido_externo.
async function remove(id) {
  // La doble desestructuración [[pedido]] extrae directamente el primer objeto de la
  // primera fila: pool.query() devuelve [rows, fields], rows es un array de objetos,
  // y [[pedido]] equivale a rows[0]. LIMIT 1 hace la consulta eficiente: en cuanto
  // encuentra un pedido asociado detiene la búsqueda sin recorrer toda la tabla.
  const [[pedido]] = await pool.query(
    'SELECT id_pedido FROM pedido_externo WHERE producto_id_producto = ? LIMIT 1',
    [id]
  );

  // Si existe al menos un pedido vinculado al producto se lanza un error 409 Conflict.
  // Eliminar el producto dejaría esos pedidos con una FK rota (producto_id_producto sin
  // referencia válida), violando la integridad referencial de la BD.
  // Object.assign adjunta la propiedad "status" al error estándar de JavaScript para que
  // el controlador pueda diferenciarlo de otros errores y responder con el código correcto.
  if (pedido) {
    throw Object.assign(
      new Error('No se puede eliminar el producto porque tiene pedidos asociados'),
      { status: 409 }
    );
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM producto WHERE id_producto = ?',
      [id]
    );
    // true → el producto existía y fue eliminado correctamente.
    // false → affectedRows === 0, el producto no existía; el controlador responderá 404.
    return result.affectedRows > 0;
  } catch (error) {
    // ER_ROW_IS_REFERENCED_2 cubre FKs adicionales no verificadas en el SELECT previo,
    // como facturas u otras tablas que referencien producto_id_producto.
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      throw Object.assign(
        new Error('No se puede eliminar el producto porque tiene facturas o pedidos asociados.'),
        { status: 409 }
      );
    }
    throw error;
  }
}

// Retorna los proveedores asociados a un producto consultando la tabla intermedia
// producto_has_proveedor. El JOIN a proveedor permite devolver el nombre junto con
// las condiciones comerciales (precio, plazo, si es principal) de cada relación.
async function getProveedores(id) {
  const [rows] = await pool.query(
    `SELECT p.id_proveedor,
            p.nombre_proveedor,
            php.precio_compra,
            php.tiempo_entrega_dias,
            php.es_proveedor_principal
     FROM producto_has_proveedor php
     JOIN proveedor p ON p.id_proveedor = php.proveedor_id_proveedor
     WHERE php.producto_id_producto = ?`,
    [id]
  );
  return rows;
}

module.exports = { getAll, getById, create, update, remove, getProveedores };
