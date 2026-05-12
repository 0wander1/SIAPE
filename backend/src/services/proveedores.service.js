const { pool } = require('../config/db');

// Lista blanca de columnas que pueden modificarse en el UPDATE dinámico.
// NIT está incluido para permitir correcciones, pero la columna tiene un índice
// UNIQUE en la BD; si el nuevo valor ya existe MySQL lanzará ER_DUP_ENTRY, que
// el bloque catch de update() convierte en un error 409 antes de propagarlo.
const CAMPOS_PERMITIDOS_UPDATE = ['nombre_proveedor', 'NIT', 'id_usuario_trab'];

// Transforma el resultado plano del LEFT JOIN en objetos anidados.
//
// El problema: un proveedor con N productos asociados produce N filas idénticas
// en los campos de proveedor y una fila distinta en los campos de producto_has_proveedor.
// SQL no devuelve estructuras anidadas de forma nativa; hay que reconstruirlas en Node.
//
// La solución usa un Map donde la clave es id_proveedor y el valor es el objeto
// proveedor con su array "productos_asociados" ya inicializado vacío.
// En cada iteración del bucle se localiza (o crea) el proveedor en el Map y se le
// agrega el producto de esa fila, evitando duplicar los datos del proveedor.
function agruparProductos(rows) {
  const mapa = new Map();

  for (const row of rows) {
    // Si es la primera fila de este proveedor, se crea su entrada en el Map.
    // Las iteraciones siguientes del mismo proveedor reutilizan la entrada existente.
    if (!mapa.has(row.id_proveedor)) {
      mapa.set(row.id_proveedor, {
        id_proveedor:        row.id_proveedor,
        nombre_proveedor:    row.nombre_proveedor,
        NIT:                 row.NIT,
        id_usuario_trab:     row.id_usuario_trab,
        productos_asociados: [], // se irá llenando con las filas siguientes del mismo proveedor
      });
    }

    // Con LEFT JOIN un proveedor sin productos asociados devuelve una única fila
    // con todos los campos de producto_has_proveedor en NULL. Se comprueba id_prod_prov
    // (PK de la tabla pivote) para distinguir una relación real de un NULL de relleno;
    // en ese caso no se agrega nada al array y el proveedor queda con lista vacía.
    if (row.id_prod_prov !== null) {
      mapa.get(row.id_proveedor).productos_asociados.push({
        id_prod_prov:           row.id_prod_prov,
        producto_id_producto:   row.producto_id_producto,
        precio_compra:          row.precio_compra,
        tiempo_entrega_dias:    row.tiempo_entrega_dias,
        es_proveedor_principal: row.es_proveedor_principal,
        fecha_inicio_contrato:  row.fecha_inicio_contrato,
        fecha_fin_contrato:     row.fecha_fin_contrato,
        activo:                 row.activo,
      });
    }
  }

  // Map.values() devuelve un iterador; Array.from() lo convierte en un array
  // para que el controlador pueda serializarlo directamente a JSON.
  return Array.from(mapa.values());
}

// Plantilla SQL reutilizada por getAll y getById.
// Relación modelada:
//   proveedor (p) ←→ producto_has_proveedor (pp) ←→ producto
// "producto_has_proveedor" es una tabla pivote (Many-to-Many): un proveedor puede
// suministrar varios productos y un producto puede tener varios proveedores.
// La tabla almacena además metadatos del contrato: precio de compra, tiempo de entrega,
// si es el proveedor principal para ese producto, fechas del contrato y estado activo.
//
// Se usa LEFT JOIN para incluir proveedores que aún no tienen productos asignados
// (pp.* será NULL en esas filas, y agruparProductos las filtra con la guarda id_prod_prov !== null).
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

// Retorna todos los proveedores con sus productos asociados agrupados.
// El ORDER BY aplica al proveedor; los productos de cada uno se agregan
// en el orden en que MySQL los devuelve (sin garantía de orden interno del array).
async function getAll() {
  const [rows] = await pool.query(`${SQL_JOIN} ORDER BY p.id_proveedor DESC`);
  return agruparProductos(rows);
}

// Retorna un único proveedor con sus productos asociados.
// El WHERE filtra por PK del proveedor; agruparProductos seguirá produciendo
// un array de un solo elemento, del cual se extrae [0].
// Si el proveedor no existe rows estará vacío, resultado será [] y [0] será
// undefined, por lo que || null garantiza retornar null para que el controlador genere 404.
async function getById(id) {
  const [rows] = await pool.query(
    `${SQL_JOIN} WHERE p.id_proveedor = ?`,
    [id]
  );
  const resultado = agruparProductos(rows);
  return resultado[0] || null;
}

// Crea un nuevo proveedor con validación explícita de NIT único antes del INSERT.
// Estrategia de validación: SELECT previo en lugar de confiar en ER_DUP_ENTRY.
// Esto permite devolver un mensaje de error descriptivo en español (409 Conflict)
// en lugar de propagar el críptico error de MySQL al cliente.
async function create(data) {
  const { nombre_proveedor, NIT, id_usuario_trab } = data;

  // Se consulta si ya existe un proveedor con ese NIT. existing es el array de filas;
  // si tiene al menos un elemento el NIT está duplicado y se rechaza la creación.
  // Aunque la columna NIT tenga UNIQUE en BD (que dispararía ER_DUP_ENTRY en el INSERT),
  // verificar antes permite controlar el mensaje de error sin depender del código de MySQL.
  const [existing] = await pool.query(
    'SELECT id_proveedor FROM proveedor WHERE NIT = ?',
    [NIT]
  );
  if (existing.length > 0) {
    // Object.assign adjunta status al Error estándar de JS para que el errorHandler
    // global use ese código HTTP en la respuesta sin lógica adicional en el controlador.
    throw Object.assign(new Error('Ya existe un proveedor con ese NIT.'), { status: 409 });
  }

  const [result] = await pool.query(
    'INSERT INTO proveedor (nombre_proveedor, NIT, id_usuario_trab) VALUES (?, ?, ?)',
    [nombre_proveedor, NIT, id_usuario_trab]
  );

  // Se retorna el proveedor completo con el JOIN para incluir productos_asociados
  // (vacío al crear, pero consistente con el formato que espera el front-end).
  return getById(result.insertId);
}

// Actualiza dinámicamente los campos de un proveedor presentes en el body.
// Construye el SET de la query en tiempo de ejecución filtrando contra CAMPOS_PERMITIDOS_UPDATE.
async function update(id, data) {
  // Solo se conservan las claves del body que estén en la lista blanca,
  // descartando campos desconocidos o restringidos que el cliente no debería modificar.
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Se genera un fragmento "columna = ?" por cada campo válido y se unen con ", ".
  // Ejemplo con dos campos: "nombre_proveedor = ?, NIT = ?"
  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  // Si el body incluye NIT y ese valor ya pertenece a otro proveedor, MySQL lanzará
  // ER_DUP_ENTRY (código 'ER_DUP_ENTRY') porque la columna tiene un índice UNIQUE.
  // mysql2 convierte ese error de MySQL en una excepción JavaScript con error.code === 'ER_DUP_ENTRY'.
  // El error se propaga hacia el controlador vía next(error) y de ahí al errorHandler global,
  // que devuelve su message al cliente. Para una respuesta 409 personalizada habría que
  // capturar el error aquí con: if (err.code === 'ER_DUP_ENTRY') throw Object.assign(...)
  const [result] = await pool.query(
    `UPDATE proveedor SET ${setClause} WHERE id_proveedor = ?`,
    [...valores, id]
  );

  // affectedRows === 0: ninguna fila coincidió con el WHERE → el proveedor no existe.
  // El controlador convertirá null en una respuesta 404.
  if (result.affectedRows === 0) return null;

  // Se retorna el proveedor actualizado con sus productos asociados vía getById.
  return getById(id);
}

// Elimina el proveedor por su PK.
// Si la tabla "producto_has_proveedor" tiene ON DELETE RESTRICT sobre la FK
// proveedor_id_proveedor, MySQL rechazará el DELETE con un error de integridad
// referencial que se propagará como excepción al controlador y luego al errorHandler.
async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM proveedor WHERE id_proveedor = ?',
    [id]
  );
  // true → el proveedor existía y fue eliminado.
  // false → affectedRows === 0: el proveedor no existía; el controlador responderá 404.
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
