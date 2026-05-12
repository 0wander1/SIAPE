const { pool } = require('../config/db');

// Lista blanca de columnas que pueden modificarse en un UPDATE de inventario.
// Filtrar el body contra esta lista impide que el cliente inyecte columnas arbitrarias
// (como id_inventario o ultima_actualizacion) en el SET de la query dinámica.
const CAMPOS_PERMITIDOS_UPDATE = [
  'cantidad_disponible',
  'cantidad_reservada',
  'cantidad_minima',
  'producto_id_producto',
  'bodega_id_bodega',
];

// Retorna todos los registros de inventario enriquecidos con nombre de producto y descripción
// de bodega mediante LEFT JOIN. Se usa LEFT JOIN en lugar de INNER JOIN para que registros
// cuya FK de producto o bodega haya quedado huérfana igualmente aparezcan en el listado,
// con esos campos como null en lugar de desaparecer del resultado.
async function getAll() {
  const [rows] = await pool.query(
    `SELECT
       i.id_inventario,
       i.cantidad_disponible,
       i.cantidad_reservada,
       i.cantidad_minima,
       i.ultima_actualizacion,
       i.producto_id_producto,
       i.bodega_id_bodega,
       p.nombre_producto,
       b.descripcion AS descripcion_bodega
     FROM inventario i
     LEFT JOIN producto p ON i.producto_id_producto = p.id_producto
     LEFT JOIN bodega b   ON i.bodega_id_bodega = b.id_bodega
     ORDER BY i.id_inventario DESC`
  );
  return rows;
}

// Retorna un único registro por PK. SELECT * es aceptable aquí porque getById
// solo se usa internamente (después de create/update) para devolver el estado final,
// no como endpoint de listado público que podría exponer columnas innecesarias.
async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM inventario WHERE id_inventario = ?',
    [id]
  );
  return rows[0] || null;
}

// Inserta un nuevo registro de inventario. Los campos opcionales usan ?? para convertir
// undefined (campo no enviado) en un valor por defecto explícito en lugar de NULL,
// garantizando que las cantidades siempre sean numéricas en la BD.
async function create(data) {
  const {
    cantidad_disponible,
    cantidad_reservada,
    cantidad_minima,
    producto_id_producto,
    bodega_id_bodega,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO inventario
      (cantidad_disponible, cantidad_reservada, cantidad_minima,
       producto_id_producto, bodega_id_bodega, ultima_actualizacion)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [
      cantidad_disponible,
      cantidad_reservada ?? 0,  // si no se envió, el stock reservado comienza en 0
      cantidad_minima    ?? 0,  // si no se envió, no hay umbral de alerta configurado
      producto_id_producto,
      bodega_id_bodega,
    ]
  );

  // Se retorna el registro completo usando su PK recién generada para reflejar
  // exactamente cómo quedó en BD, incluyendo ultima_actualizacion asignada por NOW().
  return getById(result.insertId);
}

// Actualiza de forma dinámica los campos de un registro de inventario.
// La query SET se construye en tiempo de ejecución según los campos recibidos en el body,
// permitiendo actualizaciones parciales sin necesitar un endpoint por cada combinación.
async function update(id, data) {
  // Se conservan solo las claves del body que estén en la lista blanca.
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  // Si ningún campo del body coincide con la lista blanca no tiene sentido ejecutar el UPDATE.
  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Se construye el fragmento SET de la query:
  //   - campos.map() genera "columna = ?" por cada campo válido del body.
  //   - 'ultima_actualizacion = NOW()' se agrega siempre como literal SQL para que el
  //     timestamp lo fije el servidor MySQL y no dependa del reloj del servidor Node.
  // join(', ') une todos los fragmentos en una cadena lista para el UPDATE.
  const setClause = [...campos.map((c) => `${c} = ?`), 'ultima_actualizacion = NOW()'].join(', ');
  const valores   = campos.map((c) => data[c]);

  // La query final queda, por ejemplo:
  //   UPDATE inventario SET cantidad_disponible = ?, ultima_actualizacion = NOW() WHERE id_inventario = ?
  // El spread [...valores, id] coloca los valores de SET primero y el id al final,
  // en el mismo orden en que aparecen los "?" en la query.
  const [result] = await pool.query(
    `UPDATE inventario SET ${setClause} WHERE id_inventario = ?`,
    [...valores, id]
  );

  // affectedRows === 0 significa que ninguna fila coincidió con el WHERE:
  // el registro de inventario con ese id no existe. El controlador convertirá null en 404.
  if (result.affectedRows === 0) return null;
  return getById(id);
}

// Elimina el registro por PK. Retorna true si se eliminó, false si no existía.
async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM inventario WHERE id_inventario = ?',
    [id]
  );
  return result.affectedRows > 0;
}

// Procesa un array de filas provenientes de un Excel convertido a JSON por el front-end.
// Cada fila representa un producto con sus cantidades de inventario en una bodega concreta.
// El procesamiento es fila a fila: un error en una fila no aborta las demás, sino que
// se registra en el array "errores" y se continúa con la siguiente.
async function cargaMasiva(filas) {
  let creados     = 0;  // filas que generaron un nuevo registro de inventario
  let actualizados = 0; // filas que actualizaron un registro de inventario existente
  const errores   = []; // mensajes de filas que fallaron (validación o error de BD)

  // Se obtiene una conexión dedicada para reutilizarla en todas las filas del lote,
  // evitando el coste de solicitar y liberar una conexión por cada iteración del bucle.
  const conn = await pool.getConnection();
  try {
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];

      // --- Extracción y normalización de campos ---
      // Los valores vienen como strings desde el JSON; Number() los convierte al tipo
      // numérico que espera MySQL. || 0 garantiza que un valor vacío o no numérico
      // resulte en 0 en lugar de NaN, que causaría un error en la inserción.
      const nombre_producto     = fila.nombre_producto;
      const bodega_id_bodega    = Number(fila.bodega_id_bodega);
      const cantidad_disponible = Number(fila.cantidad_disponible) || 0;
      const cantidad_reservada  = Number(fila.cantidad_reservada)  || 0;
      const cantidad_minima     = Number(fila.cantidad_minima)     || 0;

      // Los campos opcionales admiten dos formatos de nombre de columna en el Excel:
      // el nombre exacto ("valor_neto") o el formato con sufijo que muestra la plantilla
      // ("valor_neto (opcional)"). El operador ?? toma el primero que no sea null/undefined.
      const _valor_neto        = fila.valor_neto        ?? fila['valor_neto (opcional)'];
      const _valor_de_venta    = fila.valor_de_venta    ?? fila['valor_de_venta (opcional)'];
      const _lote              = fila.lote              ?? fila['lote (opcional)'];
      const _fecha_vencimiento = fila.fecha_vencimiento ?? fila['fecha_vencimiento (opcional)'];

      // Conversión de opcionales: != null (cubre tanto null como undefined) comprueba si
      // el campo llegó con algún valor antes de convertirlo, evitando NaN o "null" como string.
      const valor_neto     = _valor_neto     != null ? Number(_valor_neto)     : 0;
      const valor_de_venta = _valor_de_venta != null ? Number(_valor_de_venta) : 0;
      const lote           = _lote           != null ? String(_lote)           : null;

      // Las fechas en Excel se almacenan internamente como números decimales que representan
      // días transcurridos desde el 1 de enero de 1900 (época de Excel). La fórmula de
      // conversión es: (serialExcel - 25569) * 86400 * 1000
      //   - 25569 ajusta la diferencia de épocas entre Excel (1900) y Unix (1970).
      //   - 86400 * 1000 convierte días a milisegundos para el constructor de Date.
      // Math.round() elimina la parte decimal causada por la precisión de punto flotante.
      // Si el valor ya es un string (el usuario escribió la fecha a mano) se usa tal cual.
      // toISOString().split('T')[0] extrae solo la parte "YYYY-MM-DD" que acepta MySQL.
      const fecha_vencimiento = _fecha_vencimiento == null
        ? null
        : typeof _fecha_vencimiento === 'number'
          ? new Date(Math.round((_fecha_vencimiento - 25569) * 86400 * 1000)).toISOString().split('T')[0]
          : String(_fecha_vencimiento);

      // Validación de campos obligatorios por fila. El índice i + 2 refleja la fila real
      // en el Excel: la fila 1 es el encabezado, por lo que los datos empiezan en la fila 2.
      if (!nombre_producto || !bodega_id_bodega) {
        errores.push(`Fila ${i + 2}: nombre_producto y bodega_id_bodega son requeridos.`);
        continue; // se salta esta fila y se continúa con la siguiente
      }

      try {
        // Cada fila se procesa en su propia transacción para que un fallo en BD
        // (p. ej. FK inválida) revierta solo esa fila sin afectar las anteriores.
        await conn.beginTransaction();

        // --- Paso 1: Buscar el producto por nombre ---
        // Se usa el nombre como identificador natural porque el Excel no contiene PKs.
        // La doble desestructuración [[productoExistente]] extrae directamente el primer
        // objeto de la primera fila del resultado, equivalente a rows[0].
        const [[productoExistente]] = await conn.query(
          'SELECT id_producto FROM producto WHERE nombre_producto = ?',
          [nombre_producto]
        );

        let producto_id_producto;
        if (productoExistente) {
          // El producto ya existe: se reutiliza su PK para el inventario.
          // No se actualizan sus campos (valor_neto, lote, etc.) para no sobrescribir
          // datos que el usuario pudo haber ajustado manualmente en la BD.
          producto_id_producto = productoExistente.id_producto;
        } else {
          // El producto no existe: se crea con los valores mínimos extraídos de la fila.
          // valor_neto, valor_de_venta, lote y fecha_vencimiento son opcionales en el Excel;
          // si no se enviaron se insertaron como 0 o null respectivamente (ver conversión arriba).
          const [prodResult] = await conn.query(
            `INSERT INTO producto
               (nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombre_producto, valor_neto, valor_de_venta, lote, fecha_vencimiento, bodega_id_bodega]
          );
          producto_id_producto = prodResult.insertId;
        }

        // --- Paso 2: Buscar el registro de inventario para ese producto y bodega ---
        // La combinación (producto_id_producto, bodega_id_bodega) identifica unívocamente
        // el stock de un producto en una ubicación concreta; puede haber el mismo producto
        // en múltiples bodegas como registros de inventario independientes.
        const [[invExistente]] = await conn.query(
          'SELECT id_inventario FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
          [producto_id_producto, bodega_id_bodega]
        );

        if (invExistente) {
          // Ya existe un registro de inventario para esa combinación: se actualizan las
          // cantidades con los valores del Excel, reemplazando los valores anteriores.
          // ultima_actualizacion se establece a NOW() para tener trazabilidad del cambio.
          await conn.query(
            `UPDATE inventario SET
               cantidad_disponible  = ?,
               cantidad_reservada   = ?,
               cantidad_minima      = ?,
               ultima_actualizacion = NOW()
             WHERE id_inventario = ?`,
            [cantidad_disponible, cantidad_reservada, cantidad_minima, invExistente.id_inventario]
          );
          actualizados++;
        } else {
          // No existe registro de inventario para esa combinación producto + bodega:
          // se crea uno nuevo con las cantidades del Excel.
          await conn.query(
            `INSERT INTO inventario
               (cantidad_disponible, cantidad_reservada, cantidad_minima,
                producto_id_producto, bodega_id_bodega, ultima_actualizacion)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [cantidad_disponible, cantidad_reservada, cantidad_minima, producto_id_producto, bodega_id_bodega]
          );
          creados++;
        }

        // Se confirman los cambios de esta fila (producto + inventario) de forma atómica.
        await conn.commit();
      } catch (err) {
        // Cualquier error de BD en esta fila (FK inválida, duplicado, etc.) revierte
        // solo la transacción de esta fila. El error se registra en el array y el bucle
        // continúa con la siguiente fila del Excel.
        await conn.rollback();
        errores.push(`Fila ${i + 2}: ${err.message}`);
      }
    }
  } finally {
    // finally garantiza que la conexión se devuelva al pool aunque el bucle termine
    // con una excepción inesperada fuera del try interno de cada fila.
    conn.release();
  }

  // Se retorna un resumen con los contadores y los errores acumulados para que el
  // front-end pueda informar al usuario cuántas filas se procesaron correctamente
  // y cuáles fallaron con su mensaje de error específico.
  return { creados, actualizados, errores };
}

module.exports = { getAll, getById, create, update, remove, cargaMasiva };
