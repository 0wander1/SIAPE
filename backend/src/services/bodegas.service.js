const { pool } = require('../config/db');

// Lista blanca de columnas que pueden modificarse en el UPDATE dinámico.
// Descripción de cada campo de la tabla bodega:
//   descripcion:                 nombre o etiqueta de la bodega (texto libre).
//   ubicacion:                   dirección física o referencia geográfica de la bodega.
//   ciudad:                      ciudad donde se encuentra físicamente la bodega.
//   capacidad_maxima:            límite absoluto de unidades/volumen que puede almacenar.
//   capacidad_actual:            unidades actualmente almacenadas; se actualiza cada vez
//                                que entra o sale mercancía del inventario.
//   tipo_bodega:                 ENUM en BD con tres valores posibles:
//                                  'principal'  → bodega central de almacenamiento masivo.
//                                  'secundaria' → bodega de apoyo o distribución regional.
//                                  'transito'   → espacio temporal para mercancía en tránsito.
//                                MySQL rechaza cualquier valor fuera de ese conjunto con un error.
//   activa:                      TINYINT(1) que actúa como booleano en MySQL:
//                                  1 → la bodega está operativa y puede recibir inventario.
//                                  0 → la bodega está desactivada (fuera de servicio, en mantenimiento, etc.).
//                                Se usa TINYINT en lugar de BOOLEAN porque MySQL almacena
//                                BOOLEAN internamente como TINYINT(1) y mysql2 lo devuelve
//                                como número (0 o 1), no como true/false de JavaScript.
//   usuario_trab_id_responsable: FK al trabajador (usuario_trab) designado como responsable
//                                de la gestión y supervisión de la bodega.
const CAMPOS_PERMITIDOS_UPDATE = [
  'descripcion',
  'ubicacion',
  'ciudad',
  'capacidad_maxima',
  'capacidad_actual',
  'tipo_bodega',
  'activa',
  'usuario_trab_id_responsable',
];

// Retorna todas las bodegas con todos sus campos, ordenadas por id descendente.
// SELECT * es aceptable aquí porque la tabla bodega no tiene columnas sensibles
// y el listado completo es el comportamiento esperado por el front-end.
async function getAll() {
  const [rows] = await pool.query(
    'SELECT * FROM bodega ORDER BY id_bodega DESC'
  );
  return rows;
}

// Retorna una bodega específica por su PK. rows[0] es undefined si no hay resultados,
// por lo que || null garantiza retornar null explícito para que el controlador genere 404.
async function getById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM bodega WHERE id_bodega = ?',
    [id]
  );
  return rows[0] || null;
}

// Inserta una nueva bodega en la BD con todos sus campos.
async function create(data) {
  const {
    descripcion,
    ubicacion,
    ciudad,
    capacidad_maxima,
    capacidad_actual,         // opcional: unidades ya almacenadas al momento de crear la bodega
    tipo_bodega,              // ENUM: 'principal' | 'secundaria' | 'transito'
    activa,                   // TINYINT(1): 1 = operativa, 0 = fuera de servicio
    usuario_trab_id_responsable,
  } = data;

  try {
    const [result] = await pool.query(
      `INSERT INTO bodega
        (descripcion, ubicacion, ciudad, capacidad_maxima, capacidad_actual,
         tipo_bodega, activa, usuario_trab_id_responsable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        descripcion,
        ubicacion,
        ciudad,
        capacidad_maxima,
        // Si capacidad_actual no se envía en el body, la bodega empieza vacía (0 unidades).
        // ?? 0 usa nullish coalescing: solo aplica el default si el valor es null o undefined,
        // permitiendo que se envíe explícitamente 0 sin ser reemplazado.
        capacidad_actual ?? 0,
        // tipo_bodega se pasa tal cual; si el valor no es uno de los tres valores del ENUM
        // ('principal', 'secundaria', 'transito'), MySQL lanzará un error en el INSERT.
        tipo_bodega,
        // activa por defecto es 1 (operativa). Se usa ?? para que enviar explícitamente
        // activa: 0 al crear siga funcionando (por ejemplo, registrar una bodega aún no habilitada).
        // Con || en cambio, el 0 sería falsy y se reemplazaría incorrectamente por 1.
        activa ?? 1,
        usuario_trab_id_responsable,
      ]
    );

    // Se retorna la bodega completa usando la PK recién generada para reflejar
    // exactamente cómo quedó en BD, incluyendo cualquier default asignado por MySQL.
    return getById(result.insertId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw Object.assign(
        new Error('Ya existe una bodega con ese nombre.'),
        { status: 409 }
      );
    }
    throw error;
  }
}

// Actualiza dinámicamente los campos de una bodega presentes en el body.
// La query SET se construye en tiempo de ejecución para soportar actualizaciones
// parciales: se puede cambiar solo "activa", solo "capacidad_actual", etc.
async function update(id, data) {
  // Se filtran las claves del body contra la lista blanca para descartar campos
  // desconocidos o columnas internas (como id_bodega) que el cliente no debe modificar.
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  // Si ningún campo del body coincide con la lista blanca no se ejecuta el UPDATE,
  // y se lanza un error 400 para informar al cliente que debe enviar al menos un campo válido.
  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Se construye el fragmento SET de la query de forma dinámica:
  //   campos.map((c) => `${c} = ?`) genera ["descripcion = ?", "activa = ?", ...]
  //   .join(', ') los une en "descripcion = ?, activa = ?"
  // Cada "?" se corresponde en orden con el valor del mismo índice en el array "valores".
  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  // Ejemplo de query final con dos campos: UPDATE bodega SET activa = ?, ciudad = ? WHERE id_bodega = ?
  // El spread [...valores, id] coloca los valores de SET primero y el id de la condición
  // WHERE al final, respetando el orden de los "?" en la query.
  // Nota sobre tipo_bodega en UPDATE: si se envía un valor fuera del ENUM, MySQL lo rechazará
  // y la excepción llegará al controlador vía el throw implícito de pool.query().
  // Nota sobre activa en UPDATE: enviar activa: 0 funciona correctamente porque
  // data['activa'] devuelve 0 (número), que mysql2 acepta para TINYINT(1).
  const [result] = await pool.query(
    `UPDATE bodega SET ${setClause} WHERE id_bodega = ?`,
    [...valores, id]
  );

  // affectedRows === 0 indica que el WHERE no coincidió con ninguna fila:
  // la bodega con ese id no existe. El controlador convertirá null en una respuesta 404.
  if (result.affectedRows === 0) return null;

  // Se retorna la bodega con sus valores actualizados directamente desde BD para
  // garantizar que la respuesta refleja el estado real persistido, incluyendo el
  // valor almacenado del ENUM y del TINYINT tal como MySQL los devuelve.
  return getById(id);
}

// Elimina la bodega por su PK. No realiza verificaciones previas de dependencias;
// si hay registros de inventario u otras entidades con FK hacia esta bodega y la
// restricción es ON DELETE RESTRICT, MySQL rechazará el DELETE con una excepción
// que se propagará al controlador y luego al errorHandler global.
// ER_ROW_IS_REFERENCED_2 es el código que lanza MySQL cuando el DELETE viola una FK
// con ON DELETE RESTRICT. Se captura aquí para devolver un mensaje descriptivo en
// español (409 Conflict) en lugar del críptico error de MySQL al cliente.
async function remove(id) {
  try {
    const [result] = await pool.query(
      'DELETE FROM bodega WHERE id_bodega = ?',
      [id]
    );
    // true → la bodega existía y fue eliminada correctamente.
    // false → affectedRows === 0: la bodega no existía; el controlador responderá 404.
    return result.affectedRows > 0;
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      throw Object.assign(
        new Error('No se puede eliminar la bodega porque tiene productos o inventario asociado.'),
        { status: 409 }
      );
    }
    throw error;
  }
}

module.exports = { getAll, getById, create, update, remove };
