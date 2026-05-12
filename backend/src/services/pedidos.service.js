const { pool } = require('../config/db');

// Lista blanca de columnas que pueden modificarse mediante la operación update.
// Filtrar el body del cliente contra esta lista evita que un usuario malintencionado
// inyecte columnas arbitrarias en el SET de la query (p. ej. id_pedido o claves foráneas
// no permitidas), sin necesidad de construir una query con columnas fijas.
const CAMPOS_PERMITIDOS_UPDATE = [
  'cliente_id_usuario_cli',
  'producto_id_producto',
  'cantidad',
  'estado',
  'valor_total',
  'direccion_pedido',
  'fecha_entrega_estimada',
  'fecha_entrega_real',
  'observaciones',
  'usuario_trab_id',
  'tiempo_id_tiempo',
];

// Plantilla SQL reutilizada por getAll y getById. Usa LEFT JOIN en lugar de INNER JOIN
// para que un pedido cuyo cliente o producto haya sido eliminado (o tenga FK rota)
// igualmente aparezca en los resultados, con los campos de la tabla unida como null.
//
// Cadena de JOINs explicada paso a paso:
//   pedido_externo pe  → tabla principal con los datos del pedido.
//   LEFT JOIN cliente c    → une por la FK cliente_id_usuario_cli para acceder a la tabla cliente.
//   LEFT JOIN usuario u    → une cliente con usuario para obtener el nombre legible del cliente.
//   LEFT JOIN producto p   → une por la FK producto_id_producto para obtener el nombre del producto.
//
// Los alias (AS id, AS clienteId, etc.) convierten los nombres de columna de la BD
// (snake_case) al formato camelCase esperado por el front-end, evitando transformaciones
// adicionales en el controlador.
const SQL_SELECT = `
  SELECT
    pe.id_pedido                AS id,
    pe.cliente_id_usuario_cli   AS clienteId,
    pe.producto_id_producto     AS productoId,
    u.nombre_usuario            AS cliente,
    p.nombre_producto           AS producto,
    pe.cantidad,
    pe.estado,
    pe.valor_total              AS valorTotal,
    pe.direccion_pedido         AS direccion,
    pe.fecha_entrega_estimada   AS fechaEstimada,
    pe.fecha_entrega_real       AS fechaReal,
    pe.observaciones
  FROM pedido_externo pe
  LEFT JOIN cliente    c ON pe.cliente_id_usuario_cli = c.id_usuario_cli
  LEFT JOIN usuario    u ON c.id_usuario_cli           = u.id_usuario
  LEFT JOIN producto   p ON pe.producto_id_producto    = p.id_producto
`;

// Retorna todos los pedidos ordenados por id descendente (el más reciente primero).
// pool.query() puede usarse aquí porque la operación es de solo lectura y no requiere
// control transaccional; el pool asigna automáticamente una conexión disponible.
async function getAll() {
  const [rows] = await pool.query(`${SQL_SELECT} ORDER BY pe.id_pedido DESC`);
  return rows;
}

// Retorna un único pedido filtrando por PK. El "?" previene inyección SQL.
// rows[0] es el primer resultado; si no hay filas se retorna null para que el
// controlador responda 404 sin necesitar lógica adicional en el servicio.
async function getById(id) {
  const [rows] = await pool.query(
    `${SQL_SELECT} WHERE pe.id_pedido = ?`,
    [id]
  );
  return rows[0] || null;
}

// Crea un pedido nuevo usando una transacción que abarca dos inserciones:
// 1. INSERT en "tiempo" para registrar el momento exacto del pedido.
// 2. INSERT en "pedido_externo" vinculado al registro de tiempo recién creado.
// Si cualquiera de las dos falla, el rollback deshace ambas, garantizando que nunca
// exista un registro de tiempo huérfano ni un pedido sin dimensión temporal.
async function create(data) {
  const {
    cliente_id_usuario_cli,
    producto_id_producto,
    cantidad,
    estado,
    valor_total,
    direccion_pedido,
    fecha_entrega_estimada,
    fecha_entrega_real,
    observaciones,
    usuario_trab_id,
  } = data;

  // Se obtiene una conexión dedicada del pool para poder controlar la transacción.
  // pool.getConnection() reserva la misma conexión física para todas las operaciones
  // hasta que se llame a conn.release(), evitando que el pool la reasigne a otro cliente.
  const conn = await pool.getConnection();
  try {
    // beginTransaction() deshabilita el autocommit en esta conexión. A partir de aquí
    // ningún cambio es visible para otras conexiones hasta que se llame a commit().
    await conn.beginTransaction();

    // --- Primera inserción: tabla "tiempo" ---
    // La tabla tiempo es una dimensión de fecha para análisis (esquema estrella).
    // NOW() captura el instante actual del servidor MySQL y todas las funciones de fecha
    // (YEAR, MONTH, WEEK, QUARTER, DAYNAME, DAY) descomponen ese timestamp en columnas
    // individuales que facilitan consultas de reportes por período sin recalcular en cada query.
    // DAYOFWEEK() IN (1,7) evalúa a 1 (true) si el día es domingo (1) o sábado (7), y a 0 si no.
    // es_festivo se deja en 0 porque no hay calendario de festivos automatizado.
    const [tiempoResult] = await conn.query(
      `INSERT INTO tiempo
        (fecha_hora, anio, mes, semana, trimestre, dia_semana, es_fin_semana, es_festivo, dia)
       VALUES (NOW(), YEAR(NOW()), MONTH(NOW()), WEEK(NOW()), QUARTER(NOW()),
               DAYNAME(NOW()), DAYOFWEEK(NOW()) IN (1,7), 0, DAY(NOW()))`
    );

    // insertId es la PK autogenerada por MySQL para el registro de tiempo recién insertado.
    // Se usa como FK en el INSERT del pedido para enlazar ambos registros.
    const tiempo_id_tiempo = tiempoResult.insertId;

    // --- Segunda inserción: tabla "pedido_externo" ---
    // Los campos opcionales usan el operador nullish coalescing (??) para convertir
    // undefined (campo no enviado en el body) a null explícito. Pasar undefined a un
    // PreparedStatement de mysql2 puede causar errores según la versión del driver.
    const [pedidoResult] = await conn.query(
      `INSERT INTO pedido_externo
        (cliente_id_usuario_cli, producto_id_producto, cantidad, estado, valor_total,
         direccion_pedido, fecha_entrega_estimada, fecha_entrega_real, observaciones,
         usuario_trab_id, tiempo_id_tiempo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente_id_usuario_cli,
        producto_id_producto,
        cantidad,
        estado,
        valor_total,
        direccion_pedido,
        fecha_entrega_estimada ?? null,  // opcional: fecha prevista de entrega
        fecha_entrega_real     ?? null,  // opcional: normalmente null al crear
        observaciones          ?? null,  // opcional: notas adicionales del pedido
        usuario_trab_id,
        tiempo_id_tiempo,                // FK al registro de tiempo recién creado
      ]
    );

    // commit() persiste ambas inserciones de forma atómica. Solo si llega aquí sin
    // excepción se confirman los cambios en la BD para todas las conexiones.
    await conn.commit();

    // Se retorna el pedido completo (con los JOINs de SQL_SELECT) usando el id recién generado,
    // para que el controlador pueda devolver al cliente el objeto tal como quedó en BD.
    return getById(pedidoResult.insertId);
  } catch (error) {
    // Si cualquier operación dentro del try lanza una excepción, rollback() revierte
    // todos los cambios de la transacción, dejando la BD en el estado previo.
    await conn.rollback();
    throw error;
  } finally {
    // finally se ejecuta siempre, haya habido error o no, garantizando que la conexión
    // se devuelve al pool aunque commit() o rollback() también fallen.
    conn.release();
  }
}

// Actualiza los campos de un pedido existente de forma dinámica.
// La query SET se construye en tiempo de ejecución según los campos recibidos,
// lo que permite actualizaciones parciales sin necesitar múltiples endpoints.
async function update(id, data) {
  // Se filtran las claves del body del cliente para conservar solo las que están
  // en CAMPOS_PERMITIDOS_UPDATE, descartando cualquier campo desconocido o restringido.
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  // Si tras el filtrado no queda ningún campo válido no tiene sentido ejecutar el UPDATE.
  if (campos.length === 0) {
    throw Object.assign(new Error('No se proporcionaron campos válidos para actualizar.'), { status: 400 });
  }

  // Se construyen los fragmentos "columna = ?" para el SET de la query.
  // Cada "?" será reemplazado en orden por el valor correspondiente en el array "valores".
  const setClauses = campos.map((c) => `${c} = ?`);
  const valores    = campos.map((c) => data[c]);

  // Lógica de negocio: cuando el estado cambia a "entregado" se registra automáticamente
  // la fecha y hora actuales del servidor MySQL como fecha_entrega_real. Esto evita que
  // el cliente tenga que enviar la fecha explícitamente y garantiza que sea el timestamp
  // real del servidor, no un valor que el cliente podría manipular.
  // Se agrega como literal SQL (sin "?") porque NOW() debe evaluarse en la BD, no en Node.
  if (data.estado === 'entregado') {
    setClauses.push('fecha_entrega_real = NOW()');
  }

  // La query final queda por ejemplo: UPDATE pedido_externo SET estado = ?, ... WHERE id_pedido = ?
  // El spread [...valores, id] coloca los valores de SET primero y el id al final,
  // en el mismo orden en que aparecen los "?" en la query.
  const [result] = await pool.query(
    `UPDATE pedido_externo SET ${setClauses.join(', ')} WHERE id_pedido = ?`,
    [...valores, id]
  );

  // affectedRows === 0 significa que ninguna fila coincidió con el WHERE, es decir,
  // el pedido con ese id no existe. Se retorna null para que el controlador responda 404.
  if (result.affectedRows === 0) return null;

  // Se retorna el pedido actualizado con todos sus JOINs para reflejar el estado final en BD.
  return getById(id);
}

// Elimina un pedido verificando primero que no tenga facturas asociadas,
// para preservar la integridad referencial de la base de datos.
async function remove(id) {
  // Doble desestructuración: pool.query() retorna [rows, fields]; rows es un array de objetos,
  // por lo que [[factura]] extrae directamente el primer objeto de la primera fila.
  // LIMIT 1 hace la consulta eficiente: en cuanto encuentra una factura asociada se detiene.
  const [[factura]] = await pool.query(
    'SELECT id_factura FROM factura WHERE pedido_id_pedido = ? LIMIT 1',
    [id]
  );

  // Si existe al menos una factura vinculada al pedido, se lanza un error 409 Conflict.
  // Eliminar el pedido dejaría la factura con una FK rota, lo que violaría la integridad
  // referencial. El controlador captura este error y responde 409 con el mensaje descriptivo.
  if (factura) {
    throw Object.assign(
      new Error('No se puede eliminar el pedido porque tiene una factura asociada'),
      { status: 409 }
    );
  }

  const [result] = await pool.query(
    'DELETE FROM pedido_externo WHERE id_pedido = ?',
    [id]
  );
  // affectedRows > 0 indica que la fila existía y fue eliminada correctamente.
  // false (affectedRows === 0) señala que el pedido no existía; el controlador responderá 404.
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
