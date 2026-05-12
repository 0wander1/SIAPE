const { pool } = require('../config/db');

// Solo estos dos campos pueden modificarse desde el endpoint PUT.
// La lista está declarada aunque el update no construye un SET dinámico, para
// documentar explícitamente qué campos del body se leen y cuáles se ignoran.
const CAMPOS_PERMITIDOS_UPDATE = ['nombre_usuario', 'correo'];

// Plantilla SELECT reutilizada por getAll y getById.
// El esquema de clientes está distribuido en dos tablas:
//   - "usuario": almacena el nombre genérico del usuario del sistema.
//   - "cliente": extiende a "usuario" con el correo y usa id_usuario_cli como PK y FK
//     compartida con usuario.id_usuario (patrón de herencia de tabla por clase).
// Se usa INNER JOIN porque todo cliente debe tener su fila correspondiente en usuario;
// si no la tuviera indicaría un dato corrupto que no debería aparecer en el listado.
const SQL_SELECT = `
  SELECT c.id_usuario_cli, u.nombre_usuario, c.correo
  FROM cliente c
  INNER JOIN usuario u ON c.id_usuario_cli = u.id_usuario
`;

// Retorna todos los clientes ordenados por id descendente (el más reciente primero).
async function getAll() {
  const [rows] = await pool.query(`${SQL_SELECT} ORDER BY c.id_usuario_cli DESC`);
  return rows;
}

// Retorna un cliente específico filtrando por su PK en la tabla "cliente".
// rows[0] es el primer resultado; undefined si no hay filas, por lo que || null
// asegura retornar null explícito para que el controlador genere 404.
async function getById(id) {
  const [rows] = await pool.query(`${SQL_SELECT} WHERE c.id_usuario_cli = ?`, [id]);
  return rows[0] || null;
}

// Crea un cliente usando una transacción de dos pasos sobre dos tablas distintas.
// La atomicidad es crítica aquí: si el INSERT en "cliente" fallara después de que
// "usuario" ya se insertó, quedaría un usuario huérfano sin cliente asociado.
// La transacción garantiza que ambos INSERT se confirmen juntos o ninguno lo haga.
async function create(data) {
  const { nombre_usuario, correo } = data;

  // Se obtiene una conexión dedicada para controlar la transacción manualmente.
  // pool.getConnection() reserva la misma conexión para ambos INSERTs hasta que
  // se llame a conn.release(), evitando que el pool la reasigne entre operaciones.
  const conn = await pool.getConnection();
  try {
    // beginTransaction() deshabilita el autocommit en esta conexión: ningún cambio
    // será visible para otras conexiones hasta que se llame a commit().
    await conn.beginTransaction();

    // --- Paso 1: INSERT en "usuario" ---
    // Se usa conn.execute() en lugar de conn.query() porque execute() siempre
    // envía los parámetros como un PreparedStatement compilado en el servidor,
    // lo que es ligeramente más seguro y eficiente para sentencias de escritura.
    const [usuarioResult] = await conn.execute(
      'INSERT INTO usuario (nombre_usuario) VALUES (?)',
      [nombre_usuario]
    );
    // insertId es la PK autoincremental generada por MySQL para la fila recién creada.
    // Este id se reutiliza como PK de "cliente" y FK hacia "usuario", implementando
    // la relación de herencia: un cliente ES un usuario con atributos adicionales.
    const idUsuario = usuarioResult.insertId;

    // --- Paso 2: INSERT en "cliente" ---
    // id_usuario_cli recibe el mismo valor que usuario.id_usuario, compartiendo la PK.
    // correo ?? null convierte undefined (campo no enviado) en NULL explícito para
    // que MySQL lo almacene correctamente y no falle el PreparedStatement.
    await conn.execute(
      'INSERT INTO cliente (id_usuario_cli, correo) VALUES (?, ?)',
      [idUsuario, correo ?? null]
    );

    // commit() persiste ambos INSERTs de forma atómica. Si llega aquí sin excepción,
    // los cambios quedan confirmados y visibles para el resto del sistema.
    await conn.commit();

    // Se retorna el cliente completo con el JOIN para reflejar el estado real en BD.
    return getById(idUsuario);
  } catch (err) {
    // Cualquier error en cualquiera de los dos INSERTs revierte ambos, dejando la
    // BD en el estado previo sin usuarios huérfanos ni clientes sin usuario base.
    await conn.rollback();
    throw err;
  } finally {
    // finally garantiza la liberación de la conexión al pool tanto en caso de éxito
    // como de error, evitando fugas que agotarían el pool con conexiones "prestadas".
    conn.release();
  }
}

// Actualiza nombre_usuario en "usuario" y/o correo en "cliente" de forma parcial.
// Como los datos del cliente están distribuidos en dos tablas, se necesita una
// transacción para que ambos UPDATEs sean atómicos: si el segundo falla, el primero
// también se revierte y el cliente no queda con datos inconsistentes entre tablas.
async function update(id, data) {
  const { nombre_usuario, correo } = data;

  // Se comprueba que al menos uno de los dos campos venga en el body.
  // === undefined (y no ! o == null) porque una cadena vacía podría ser un borrado
  // intencional del valor, y null también podría ser un valor válido para correo.
  if (nombre_usuario === undefined && correo === undefined) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Cada UPDATE se ejecuta condicionalmente: solo si el campo correspondiente
    // viene en el body del cliente. Esto permite actualizar solo el nombre sin
    // tocar el correo, o solo el correo sin tocar el nombre.

    // UPDATE en "usuario": afecta la fila cuya PK (id_usuario) coincide con el
    // mismo id que identifica al cliente, gracias a la PK compartida entre tablas.
    if (nombre_usuario !== undefined) {
      await conn.query(
        'UPDATE usuario SET nombre_usuario = ? WHERE id_usuario = ?',
        [nombre_usuario, id]
      );
    }

    // UPDATE en "cliente": usa id_usuario_cli que es la misma PK compartida.
    if (correo !== undefined) {
      await conn.query(
        'UPDATE cliente SET correo = ? WHERE id_usuario_cli = ?',
        [correo, id]
      );
    }

    // commit() confirma ambos UPDATEs juntos. Si cualquiera de los dos lanzó una
    // excepción, el flujo salta al catch y el rollback revierte el que sí se ejecutó.
    await conn.commit();

    // Se retorna el cliente con sus datos actualizados desde BD usando el JOIN de SQL_SELECT.
    // Si el id no existía en BD, getById retorna null y el controlador responderá 404.
    return getById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Elimina un cliente verificando primero que no tenga pedidos externos asociados,
// y luego borrando sus filas de las dos tablas en el orden correcto requerido por las FK.
async function remove(id) {
  // Se cuenta cuántos pedidos referencian este cliente antes de intentar el borrado.
  // Se usa COUNT(*) en lugar de SELECT ... LIMIT 1 porque aquí se necesita el número
  // total (para comparar > 0), no solo comprobar existencia como en otros módulos.
  // La triple desestructuración [[{ count }]] extrae directamente el valor del campo
  // "count" del primer objeto de la primera fila: pool.query() → [rows] → rows[0] → { count }.
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM pedido_externo WHERE cliente_id_usuario_cli = ?',
    [id]
  );

  // Si el cliente tiene uno o más pedidos asociados se lanza un error 409 Conflict.
  // Eliminar el cliente dejaría esos pedidos con una FK rota (cliente_id_usuario_cli
  // sin referencia válida), violando la integridad referencial de la BD.
  if (count > 0) {
    throw Object.assign(
      new Error('No se puede eliminar el cliente porque tiene pedidos asociados'),
      { status: 409 }
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // El orden de los DELETE es obligatorio por las restricciones de FK:
    //   1. Primero se borra la fila de "cliente" porque tiene una FK hacia "usuario".
    //      Si se borrara "usuario" primero, MySQL rechazaría la operación con un error
    //      de FK mientras "cliente" siga referenciando esa fila.
    //   2. Luego se borra la fila de "usuario" ahora que ya no tiene dependientes.
    await conn.query('DELETE FROM cliente  WHERE id_usuario_cli = ?', [id]);
    const [result] = await conn.query('DELETE FROM usuario WHERE id_usuario   = ?', [id]);

    await conn.commit();
    // Se evalúa affectedRows del DELETE en "usuario" (la fila raíz) para confirmar
    // que el cliente existía. Si fuera 0 significaría que el id no tenía fila en usuario.
    return result.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getAll, getById, create, update, remove };
