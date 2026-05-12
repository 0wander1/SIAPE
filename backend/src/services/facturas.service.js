const { pool } = require('../config/db');

// Lista blanca de columnas que pueden modificarse en el UPDATE dinámico.
// "total" NO está aquí porque nunca proviene directamente del cliente:
// siempre se recalcula en el servicio a partir de subtotal, impuesto y descuento,
// garantizando que el campo total de la BD sea siempre matemáticamente consistente.
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

// Campos cuya modificación implica recalcular el total.
// Se usa para detectar si el UPDATE del cliente afecta algún componente financiero.
const CAMPOS_CALCULO = ['subtotal', 'impuesto', 'descuento'];

// Calcula el total de la factura a partir de sus tres componentes financieros.
// Fórmula: total = subtotal + impuesto - descuento.
// Number() convierte explícitamente los valores porque pueden llegar como strings
// desde el body JSON o desde la BD según la versión del driver, evitando
// concatenación de strings en lugar de suma numérica.
function calcularTotal(subtotal, impuesto, descuento) {
  return Number(subtotal) + Number(impuesto) - Number(descuento);
}

// Retorna todas las facturas ordenadas por id descendente (la más reciente primero).
async function getAll() {
  const [rows] = await pool.query(
    'SELECT * FROM factura ORDER BY id_factura DESC'
  );
  return rows;
}

// Retorna una factura específica por PK. rows[0] || null permite que el
// controlador genere 404 sin lógica adicional en el servicio.
async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM factura WHERE id_factura = ?',
    [id]
  );
  return rows[0] || null;
}

// Crea una factura en una transacción que abarca validaciones, descuento de stock,
// inserción de la factura e inserción de los ítems. Todo ocurre de forma atómica:
// si cualquier paso falla, el rollback revierte todos los cambios anteriores.
//
// La función soporta dos modos de operación detectados por la presencia de pedido_id_pedido:
//   Modo A (Factura de pedido): pedido_id_pedido viene informado → se vincula la factura
//     al pedido existente y no se toca el inventario (el pedido ya gestionó su stock).
//   Modo B (Venta directa):    pedido_id_pedido es nulo → se requiere el array "productos",
//     se descuenta el inventario con bloqueo FOR UPDATE y se insertan los ítems en factura_item.
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
    productos,      // solo requerido en Modo B (venta directa)
  } = data;

  // Normaliza pedido_id_pedido: 0, string vacío o undefined se tratan como null
  // para que el campo FK en BD quede como NULL (factura sin pedido asociado).
  const pedidoId = pedido_id_pedido || null;

  // --- Validaciones previas a la transacción (Modo B) ---
  // Se validan los ítems antes de abrir la transacción para no consumir un slot
  // de conexión del pool si el body ya viene incompleto desde el cliente.
  if (!pedidoId) {
    // En venta directa es obligatorio enviar al menos un producto.
    if (!Array.isArray(productos) || productos.length === 0) {
      throw Object.assign(
        new Error('Para venta directa se requiere al menos un producto'),
        { status: 400 }
      );
    }
    // Se valida cada ítem del array: debe tener un id de producto y una cantidad ≥ 1.
    // Esta validación es rápida y no requiere BD; por eso se hace antes de beginTransaction.
    for (const item of productos) {
      if (!item.producto_id_producto || !item.cantidad || Number(item.cantidad) < 1) {
        throw Object.assign(
          new Error('Cada producto requiere producto_id_producto y cantidad válida'),
          { status: 400 }
        );
      }
    }
  }

  // Se obtiene una conexión dedicada para controlar la transacción manualmente.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ===== MODO A: Factura vinculada a un pedido =====
    if (pedidoId) {
      // Verificación de unicidad pedido→factura (relación 1:1).
      // Un pedido solo puede tener una factura asociada; si ya existe se rechaza
      // la creación para evitar doble facturación del mismo pedido.
      // Se hace dentro de la transacción para que el SELECT y el posterior INSERT
      // sean atómicos: ninguna otra conexión puede insertar una factura para el mismo
      // pedido entre el SELECT y el INSERT de esta transacción.
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

    // ===== MODO B: Venta directa con descuento de inventario =====
    } else {
      // Se procesa cada ítem del array de productos secuencialmente.
      // La secuencialidad es intencional: si un producto falla (sin stock),
      // el rollback revierte los descuentos ya aplicados a los productos anteriores.
      for (const item of productos) {

        // FOR UPDATE bloquea la fila de inventario de este producto para esta transacción.
        // Esto evita la condición de carrera en la que dos facturas concurrentes leen
        // el mismo stock disponible, ambas lo consideran suficiente y ambas lo descuentan,
        // resultando en un stock negativo. Con FOR UPDATE, la segunda transacción queda
        // en espera hasta que la primera haga commit o rollback, garantizando serialización.
        const [invRows] = await conn.query(
          'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? FOR UPDATE',
          [item.producto_id_producto]
        );

        // Si no existe fila en inventario para ese producto, no se puede vender.
        if (invRows.length === 0) {
          throw Object.assign(
            new Error(`Producto ${item.producto_id_producto} no encontrado en inventario`),
            { status: 404 }
          );
        }

        // Verificación de stock suficiente: la diferencia no puede ser negativa.
        // Se comprueba antes del UPDATE para dar un mensaje de error claro en lugar
        // de dejar que MySQL inserte un valor negativo en cantidad_disponible.
        if (invRows[0].cantidad_disponible - Number(item.cantidad) < 0) {
          throw Object.assign(
            new Error(`Stock insuficiente para el producto ${item.producto_id_producto}`),
            { status: 400 }
          );
        }

        // Descuento de stock: se usa aritmética en el servidor MySQL
        // (cantidad_disponible - ?) en lugar de calcular en Node el nuevo valor.
        // Esto evita la race condition de leer, calcular y escribir en pasos separados,
        // y es más preciso porque la operación ocurre en la misma fila ya bloqueada por FOR UPDATE.
        await conn.query(
          'UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE producto_id_producto = ?',
          [Number(item.cantidad), item.producto_id_producto]
        );
      }
    }

    // --- Cálculo automático del total ---
    // El cliente envía subtotal, impuesto (opcional, default 0) y descuento (opcional, default 0).
    // El total NUNCA proviene del cliente: siempre se calcula aquí para garantizar
    // que no pueda manipularse enviando un total arbitrario en el body.
    const total = calcularTotal(subtotal, impuesto ?? 0, descuento ?? 0);

    // --- INSERT principal en "factura" ---
    // fecha_vencimiento es opcional; ?? null evita que undefined cause error en el driver.
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
        impuesto  ?? 0,   // si no se envió impuesto, se almacena 0
        descuento ?? 0,   // si no se envió descuento, se almacena 0
        total,            // calculado en el servidor, nunca del cliente
        estado,
        usuario_trab_id,
        pedidoId,         // null si es venta directa
      ]
    );

    // insertId es la PK autogenerada para la factura recién creada.
    // Se usa como FK en factura_item para vincular los ítems a esta factura.
    const facturaId = result.insertId;

    // --- INSERT de ítems en "factura_item" (solo Modo B: venta directa) ---
    if (!pedidoId) {
      // Se construye un array de arrays para el INSERT múltiple con la sintaxis VALUES ?.
      // Cada sub-array representa una fila: [factura_id, producto_id, cantidad, valor_unitario].
      // Number(item.valor_unitario) || 0 convierte el valor a número y usa 0 si no se envió.
      const itemValues = productos.map((item) => [
        facturaId,
        item.producto_id_producto,
        Number(item.cantidad),
        Number(item.valor_unitario) || 0,
      ]);

      // La sintaxis "VALUES ?" de mysql2 acepta un array de arrays y genera automáticamente
      // los placeholders "(?, ?, ?, ?), (?, ?, ?, ?), ..." para un INSERT múltiple eficiente.
      // Esto es más eficiente que N INSERTs individuales porque reduce el número de
      // round-trips al servidor MySQL a uno solo, independientemente del número de ítems.
      await conn.query(
        'INSERT INTO factura_item (factura_id_factura, producto_id_producto, cantidad, valor_unitario) VALUES ?',
        [itemValues]
      );
    }

    // commit() persiste todos los cambios: descuentos de inventario, factura e ítems.
    await conn.commit();

    // Se retorna la factura recién creada usando getById para reflejar el estado real en BD.
    return getById(facturaId);
  } catch (err) {
    // rollback() revierte todos los cambios de la transacción: si el INSERT de factura_item
    // falla después de haber descontado el inventario, los stocks se restauran automáticamente.
    await conn.rollback();
    throw err;
  } finally {
    // finally garantiza la liberación de la conexión al pool en cualquier escenario.
    conn.release();
  }
}

// Actualiza parcialmente una factura con recálculo automático de total si es necesario.
async function update(id, data) {
  let campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Si el body modifica algún componente financiero (subtotal, impuesto o descuento),
  // el total debe recalcularse para mantener la coherencia: total = subtotal + impuesto - descuento.
  // No se puede confiar en que el cliente envíe el total correcto.
  const afectaTotal = CAMPOS_CALCULO.some((c) => campos.includes(c));
  if (afectaTotal) {
    // Se obtiene la factura actual para usar sus valores como base del recálculo.
    // Si el cliente solo envía "subtotal" sin enviar "impuesto" ni "descuento", se usan
    // los valores actuales de BD para esos dos campos, evitando resetearlos a 0.
    const actual = await getById(id);
    if (!actual) return null;

    // El operador ?? preserva el valor actual si el campo no viene en el body del cliente.
    // Esto garantiza que modificar solo subtotal no borre accidentalmente el impuesto.
    const subtotal  = data.subtotal  ?? actual.subtotal;
    const impuesto  = data.impuesto  ?? actual.impuesto;
    const descuento = data.descuento ?? actual.descuento;

    // Se agrega "total" al objeto data con el valor recalculado y a la lista de campos
    // para que quede incluido en el SET de la query UPDATE.
    data   = { ...data, total: calcularTotal(subtotal, impuesto, descuento) };
    campos = [...campos, 'total'];
  }

  // Construcción dinámica del SET: cada campo válido genera un fragmento "col = ?".
  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  const [result] = await pool.query(
    `UPDATE factura SET ${setClause} WHERE id_factura = ?`,
    [...valores, id]
  );

  // affectedRows === 0: la factura con ese id no existe → null → 404 en el controlador.
  if (result.affectedRows === 0) return null;
  return getById(id);
}

// Elimina la factura por su PK. No verifica dependencias: si existe alguna FK
// con ON DELETE RESTRICT (p. ej. en "pago"), MySQL lanzará una excepción que
// llega al controlador vía throw implícito de pool.query().
async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM factura WHERE id_factura = ?',
    [id]
  );
  // true → factura existía y fue eliminada.
  // false → affectedRows === 0: no existía; el controlador responderá 404.
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
