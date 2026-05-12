const { pool } = require('../config/db');

// Lista blanca de columnas que pueden modificarse en el UPDATE dinámico.
// No incluye campos calculados ni restricciones de integridad que deberían
// gestionarse a través del flujo de create (como el recálculo del estado de la factura).
const CAMPOS_PERMITIDOS_UPDATE = [
  'monto_pagado',
  'fecha_pago',
  'metodo_pago',
  'referencia_transaccion',       // código de referencia de la transacción (opcional)
  'factura_id_factura',
  'usuario_trab_id_usuario_trab',
];

// Retorna todos los pagos enriquecidos con el número de factura al que pertenecen.
// LEFT JOIN garantiza que si una factura fue eliminada, el pago siga apareciendo
// en el listado con numero_factura como null en lugar de desaparecer.
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
       f.numero_factura             -- dato enriquecido para mostrar en la UI
     FROM pago p
     LEFT JOIN factura f ON p.factura_id_factura = f.id_factura
     ORDER BY p.id_pago DESC`
  );
  return rows;
}

// Retorna un pago por su PK. rows[0] || null permite que el controlador genere 404.
async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM pago WHERE id_pago = ?',
    [id]
  );
  return rows[0] || null;
}

// Registra un pago parcial o total para una factura siguiendo estos pasos:
//   1. Verificar que la factura existe y obtener su total.
//   2. Sumar todos los pagos anteriores de esa factura para calcular el saldo pendiente.
//   3. Rechazar si el monto nuevo supera el saldo restante.
//   4. Insertar el pago.
//   5. Actualizar automáticamente el estado de la factura según el saldo resultante.
//
// NOTA SOBRE CONDICIÓN DE CARRERA (race condition):
// Los pasos 1-4 se ejecutan como consultas independientes sin estar envueltos en una
// transacción con FOR UPDATE. Esto significa que dos peticiones de pago simultáneas
// para la misma factura podrían:
//   a) Ambas leer el mismo saldo pendiente (p. ej. $100).
//   b) Ambas aprobar sus montos ($80 y $60 respectivamente, cada uno < $100).
//   c) Ambas insertar sus pagos, resultando en un total pagado de $140 sobre una factura de $100.
//
// La solución correcta sería:
//   conn.beginTransaction()
//   SELECT total FROM factura WHERE id_factura = ? FOR UPDATE   ← bloquea la fila de factura
//   SELECT SUM(...) FROM pago WHERE factura_id_factura = ? FOR UPDATE ← bloquea los pagos existentes
//   [validación de saldo]
//   INSERT INTO pago ...
//   UPDATE factura SET estado = ...
//   conn.commit()
//
// Con FOR UPDATE, la primera transacción que llega bloquea las filas relevantes;
// la segunda queda en espera hasta que la primera haga commit o rollback, garantizando
// que la segunda vea el saldo ya actualizado y no el saldo anterior. Este patrón es
// el mismo que se usa en facturas.service.js para proteger el inventario en ventas directas.
async function create(data) {
  const {
    monto_pagado,
    fecha_pago,
    metodo_pago,
    referencia_transaccion,
    factura_id_factura,
    usuario_trab_id_usuario_trab,
  } = data;

  // --- Paso 1: Verificar que la factura existe y obtener su total ---
  // La doble desestructuración [[factura]] extrae directamente el primer objeto
  // de la primera fila: pool.query() → [rows] → rows[0] → objeto factura.
  // Si la factura no existe, rows[0] es undefined y factura queda como undefined → falsy.
  const [[factura]] = await pool.query(
    'SELECT total FROM factura WHERE id_factura = ?',
    [factura_id_factura]
  );
  if (!factura) {
    throw Object.assign(new Error('Factura no encontrada.'), { status: 404 });
  }

  // --- Paso 2: Calcular el saldo pendiente actual ---
  // SUM(monto_pagado) suma todos los pagos ya registrados para esta factura.
  // COALESCE(..., 0) garantiza que si no hay pagos anteriores el resultado sea 0
  // y no NULL, evitando que Number(null) produzca 0 de forma silenciosa pero poco clara.
  // La triple desestructuración [[{ suma }]] extrae directamente el valor numérico
  // del campo alias "suma" del primer objeto de la primera fila del resultado.
  const [[{ suma }]] = await pool.query(
    'SELECT COALESCE(SUM(monto_pagado), 0) AS suma FROM pago WHERE factura_id_factura = ?',
    [factura_id_factura]
  );

  // saldo_pendiente = total de la factura − suma de todos los pagos anteriores.
  // Number() asegura la conversión numérica porque mysql2 puede devolver DECIMAL
  // como string según la configuración del servidor MySQL.
  const saldo_pendiente = Number(factura.total) - Number(suma);

  // --- Paso 3: Validar que el monto no supera el saldo ---
  // HTTP 422 Unprocessable Entity: la petición está bien formada pero su contenido
  // es semánticamente inválido (el monto excede lo que se puede cobrar).
  // A diferencia de 400 (campo faltante o mal formado), 422 indica que el valor
  // es técnicamente correcto pero viola una regla de negocio.
  if (Number(monto_pagado) > saldo_pendiente) {
    throw Object.assign(
      new Error(`El monto supera el saldo pendiente (${saldo_pendiente})`),
      { status: 422 }
    );
  }

  // --- Paso 4: Insertar el pago ---
  // referencia_transaccion es opcional (código de transferencia, número de cheque, etc.);
  // ?? null convierte undefined en NULL explícito para que mysql2 no falle.
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

  // --- Paso 5: Actualizar automáticamente el estado de la factura ---
  // Se calcula el saldo que quedará después de registrar este pago.
  // Si el nuevo saldo es exactamente 0, la factura queda completamente saldada → 'pagada'.
  // Si aún queda saldo positivo, hay pagos parciales pendientes → 'parcial'.
  // Este cambio de estado es automático: el usuario no necesita indicarlo explícitamente,
  // lo que elimina el riesgo de que una factura quede en estado incorrecto por olvido.
  const nuevoSaldo  = saldo_pendiente - Number(monto_pagado);
  const nuevoEstado = nuevoSaldo === 0 ? 'pagada' : 'parcial';
  await pool.query(
    'UPDATE factura SET estado = ? WHERE id_factura = ?',
    [nuevoEstado, factura_id_factura]
  );

  // Se retorna el pago recién creado con todos sus campos desde BD.
  return getById(result.insertId);
}

// Actualiza parcialmente un pago existente con los campos presentes en el body.
// NOTA: cambiar monto_pagado aquí NO recalcula el estado de la factura. Si se necesita
// ese comportamiento habría que agregar la lógica del paso 5 del create a este método.
async function update(id, data) {
  // Se filtran los campos del body contra la lista blanca para descartar columnas
  // desconocidas o restringidas que el cliente no debería poder modificar.
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Construcción dinámica del SET: cada campo válido genera un fragmento "col = ?".
  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  // El spread [...valores, id] coloca los valores del SET primero y el id del WHERE
  // al final, en el mismo orden en que aparecen los "?" en la query.
  const [result] = await pool.query(
    `UPDATE pago SET ${setClause} WHERE id_pago = ?`,
    [...valores, id]
  );

  // affectedRows === 0: el pago con ese id no existe → null → 404 en el controlador.
  if (result.affectedRows === 0) return null;
  return getById(id);
}

// Elimina el pago por su PK.
// NOTA: no revierte el estado de la factura al eliminar el pago. Si la factura
// estaba en 'pagada' y se elimina el último pago, seguirá marcada como 'pagada'
// hasta que se actualice manualmente. Para corregirlo habría que recalcular el
// estado de la factura aquí, igual que en el paso 5 del create.
async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM pago WHERE id_pago = ?',
    [id]
  );
  // true → el pago existía y fue eliminado.
  // false → affectedRows === 0: no existía; el controlador responderá 404.
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
