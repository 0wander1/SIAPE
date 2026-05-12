// bcryptjs implementa el algoritmo de hashing bcrypt en JavaScript puro.
// Se usa aquí para hashear la contraseña al crear un trabajador y para
// verificar la contraseña actual antes de permitir un cambio de contraseña.
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Lista explícita de columnas seguras que se devuelven en todas las consultas SELECT.
// password_hash y salt NUNCA se incluyen en ninguna respuesta HTTP porque:
//   - password_hash es el hash bcrypt de la contraseña; exponerlo facilita ataques
//     offline de fuerza bruta si un atacante intercepta la respuesta.
//   - salt es la sal aleatoria usada por bcrypt para generar el hash; revelarla
//     no permite revertir el hash, pero es un dato de seguridad innecesario de exponer.
// Al enumerar las columnas explícitamente aquí, si la tabla añade columnas sensibles
// en el futuro (p. ej. tokens de recuperación) tampoco se expondrán accidentalmente.
const COLUMNAS_PUBLICAS = 'id_usuario_trab, cargo, direccion, turno, celular, user_name';

// Lista blanca de columnas de perfil que pueden modificarse en el UPDATE dinámico.
// password_hash y salt quedan fuera deliberadamente: el cambio de contraseña tiene
// su propio flujo de verificación separado dentro del mismo método update().
const CAMPOS_PERMITIDOS_UPDATE = ['cargo', 'direccion', 'turno', 'celular', 'user_name'];

// Retorna todos los trabajadores seleccionando solo COLUMNAS_PUBLICAS.
// ORDER BY DESC muestra primero el trabajador más recientemente creado.
async function getAll() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuario_trab ORDER BY id_usuario_trab DESC`
  );
  return rows;
}

// Retorna un trabajador por su PK, también sin columnas sensibles.
// rows[0] es undefined si no hay resultados; || null devuelve null explícito
// para que el controlador genere una respuesta 404 sin lógica adicional.
async function getById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuario_trab WHERE id_usuario_trab = ?`,
    [id]
  );
  return rows[0] || null;
}

// Crea un trabajador hasheando primero la contraseña y luego ejecutando una
// transacción de dos inserciones para mantener la coherencia entre tablas.
async function create(data) {
  const { cargo, direccion, turno, celular, user_name, password } = data;

  // --- Generación del hash de contraseña con bcrypt ---
  // bcrypt.genSalt(10) genera una sal aleatoria con factor de coste 10.
  // El factor de coste determina cuántas rondas de hashing se realizan (2^10 = 1024).
  // Un valor de 10 es el balance habitual entre seguridad y rendimiento: tarda ~100ms
  // en un hardware moderno, lo que hace que un ataque de fuerza bruta sea costoso
  // (millones de intentos por segundo se reducen a miles).
  const salt = await bcrypt.genSalt(10);

  // bcrypt.hash() combina la contraseña en texto plano con la sal para producir
  // un hash de 60 caracteres que incluye el algoritmo, el factor de coste, la sal
  // y el hash propiamente dicho, todo en una sola cadena. Así bcrypt.compare()
  // puede extraer la sal del hash almacenado sin necesitar un campo separado;
  // sin embargo, este proyecto también almacena la sal por separado en la columna
  // "salt" de usuario_trab como referencia adicional.
  // IMPORTANTE: password nunca se almacena en BD; solo password_hash y salt.
  const password_hash = await bcrypt.hash(password, salt);

  // Se obtiene una conexión dedicada para controlar la transacción manualmente.
  // pool.getConnection() reserva la misma conexión física para ambos INSERTs.
  const conn = await pool.getConnection();
  try {
    // beginTransaction() deshabilita el autocommit: ningún cambio será visible
    // para otras conexiones hasta que se llame a commit().
    await conn.beginTransaction();

    // --- Paso 1: INSERT en "usuario" ---
    // La tabla "usuario" es la entidad base del sistema; tanto clientes como
    // trabajadores extienden de ella usando su PK como FK compartida (herencia de tabla).
    // user_name se usa como nombre_usuario porque es el identificador legible del trabajador.
    // conn.execute() (vs conn.query()) usa siempre PreparedStatement compilado en el servidor.
    const [usuarioResult] = await conn.execute(
      'INSERT INTO usuario (nombre_usuario) VALUES (?)',
      [user_name]
    );
    // insertId es la PK autoincremental generada para la fila de "usuario".
    // Este mismo id se usará como PK de "usuario_trab", vinculando ambas tablas.
    const idUsuario = usuarioResult.insertId;

    // --- Paso 2: INSERT en "usuario_trab" ---
    // id_usuario_trab recibe el mismo valor que usuario.id_usuario, implementando
    // la relación de herencia: un trabajador ES un usuario con atributos adicionales.
    // Los campos opcionales usan ?? null para que undefined se almacene como NULL
    // y no cause errores en el PreparedStatement de mysql2.
    // password_hash y salt se almacenan aquí; la contraseña original (password) NO.
    await conn.execute(
      `INSERT INTO usuario_trab
        (id_usuario_trab, cargo, direccion, turno, celular, user_name, password_hash, salt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idUsuario, cargo, direccion ?? null, turno ?? null, celular ?? null, user_name, password_hash, salt]
    );

    // commit() persiste ambos INSERTs de forma atómica. Si llegamos aquí sin excepción,
    // el trabajador queda registrado correctamente en las dos tablas.
    await conn.commit();

    // Se retorna el trabajador con COLUMNAS_PUBLICAS: sin password_hash ni salt.
    return getById(idUsuario);
  } catch (err) {
    // Si cualquier INSERT falla (user_name duplicado, FK inválida, etc.) el rollback
    // revierte ambas operaciones, evitando que quede una fila huérfana en "usuario".
    await conn.rollback();
    throw err;
  } finally {
    // finally garantiza que la conexión se devuelva al pool tanto en éxito como en error.
    conn.release();
  }
}

// Actualiza un trabajador con dos modos de operación mutuamente excluyentes,
// detectados automáticamente por la presencia de campos específicos en el body:
//
//   Modo A — Cambio de contraseña: se activa cuando el body contiene AMBOS campos
//            "contrasena_actual" y "nueva_contrasena". Verifica la contraseña actual
//            con bcrypt antes de generar un nuevo hash y actualizar las columnas
//            password_hash y salt. No modifica columnas de perfil.
//
//   Modo B — Actualización de perfil: se activa cuando el body contiene campos
//            de la lista blanca (cargo, direccion, turno, celular, user_name).
//            Construye un SET dinámico con solo los campos enviados.
//            No toca password_hash ni salt.
async function update(id, data) {
  const { contrasena_actual, nueva_contrasena } = data;

  // --- Modo A: Cambio de contraseña ---
  // Se comprueba que ambos campos estén presentes con !== undefined (y no !)
  // porque una contraseña válida podría teóricamente empezar con caracteres falsy.
  if (contrasena_actual !== undefined && nueva_contrasena !== undefined) {

    // Se obtiene solo password_hash de la BD; no se selecciona con COLUMNAS_PUBLICAS
    // porque aquí sí se necesita el hash para verificar. Este SELECT solo existe
    // dentro de este flujo de cambio de contraseña y nunca llega al cliente.
    const [[row]] = await pool.query(
      'SELECT password_hash FROM usuario_trab WHERE id_usuario_trab = ?',
      [id]
    );

    // Si el trabajador no existe, row es undefined → se retorna null → 404 en controlador.
    if (!row) return null;

    // bcrypt.compare() recalcula el hash de "contrasena_actual" usando la sal
    // embebida en "row.password_hash" y compara el resultado con el hash almacenado.
    // Retorna true si coinciden, false si no. Esta operación es deliberadamente lenta
    // para resistir ataques de fuerza bruta contra el hash obtenido de la BD.
    // NUNCA se debe comparar contraseñas con === porque bcrypt incluye una sal
    // aleatoria que hace que el mismo texto produzca hashes distintos en cada llamada.
    const matches = await bcrypt.compare(contrasena_actual, row.password_hash);
    if (!matches) {
      // Error 401 Unauthorized: las credenciales son incorrectas.
      // Object.assign adjunta status al Error para que el controlador lo capture
      // explícitamente y responda 401 con el mensaje descriptivo.
      throw Object.assign(
        new Error('La contraseña actual es incorrecta'),
        { status: 401 }
      );
    }

    // Se genera una nueva sal y un nuevo hash para la nueva contraseña.
    // Regenerar la sal en cada cambio de contraseña es una buena práctica:
    // invalida cualquier tabla de precomputación basada en la sal anterior.
    const salt    = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(nueva_contrasena, salt);

    const [result] = await pool.query(
      'UPDATE usuario_trab SET password_hash = ?, salt = ? WHERE id_usuario_trab = ?',
      [newHash, salt, id]
    );

    if (result.affectedRows === 0) return null;
    // Se retorna el trabajador sin password_hash ni salt; la nueva contraseña
    // queda en BD pero nunca regresa al cliente en ninguna forma.
    return getById(id);
  }

  // --- Modo B: Actualización de perfil ---
  // Se filtran los campos del body contra CAMPOS_PERMITIDOS_UPDATE para construir
  // el SET dinámico. password_hash y salt no están en la lista blanca, por lo que
  // no pueden ser modificados desde este flujo aunque el cliente los envíe.
  const campos = Object.keys(data).filter((k) => CAMPOS_PERMITIDOS_UPDATE.includes(k));

  if (campos.length === 0) {
    throw Object.assign(
      new Error('No se proporcionaron campos válidos para actualizar.'),
      { status: 400 }
    );
  }

  // Construcción del SET dinámico: cada campo válido genera un fragmento "col = ?".
  // Ejemplo con dos campos: "cargo = ?, turno = ?"
  const setClause = campos.map((c) => `${c} = ?`).join(', ');
  const valores   = campos.map((c) => data[c]);

  // El spread [...valores, id] coloca los valores del SET primero y el id del WHERE al
  // final, respetando el orden de los "?" en la query construida.
  const [result] = await pool.query(
    `UPDATE usuario_trab SET ${setClause} WHERE id_usuario_trab = ?`,
    [...valores, id]
  );

  // affectedRows === 0: el trabajador con ese id no existe en BD → null → 404.
  if (result.affectedRows === 0) return null;
  return getById(id);
}

// Elimina el registro de "usuario_trab". No elimina la fila padre en "usuario"
// para preservar trazabilidad histórica (facturas, pedidos, etc. que referencian
// al trabajador siguen teniendo su nombre de usuario accesible).
async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM usuario_trab WHERE id_usuario_trab = ?',
    [id]
  );
  // true → el trabajador existía y fue eliminado correctamente.
  // false → affectedRows === 0: el trabajador no existía; el controlador responderá 404.
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };
