// bcryptjs implementa el algoritmo de hashing bcrypt en JavaScript puro.
// bcrypt es un algoritmo de hash unidireccional con "factor de coste" configurable:
// cuanto mayor el coste, más tiempo tarda en calcular el hash, lo que dificulta
// ataques de fuerza bruta. Nunca se almacena la contraseña en texto plano, solo su hash.
const bcrypt = require('bcryptjs');

// jsonwebtoken permite firmar y verificar JSON Web Tokens.
const jwt = require('jsonwebtoken');

// Se importa el pool de conexiones para ejecutar consultas a MySQL.
const { pool } = require('../config/db');

// Función auxiliar privada (no exportada) que encapsula la consulta de búsqueda de usuario.
// Separar la consulta en su propia función mejora la legibilidad de "login" y facilita
// reutilizarla si en el futuro otra función del servicio necesita buscar usuarios.
async function findUserByUsername(userName) {
  // pool.query() ejecuta la consulta y devuelve un array de dos elementos: [rows, fields].
  // La desestructuración [rows] descarta "fields" (metadatos de columnas) que no se necesita.
  // El "?" es el marcador de posición que el driver reemplaza con el valor de [userName]
  // de forma segura, previniendo inyección SQL.
  // Se seleccionan solo las columnas necesarias para autenticar: PK, nombre de usuario,
  // hash de contraseña y cargo (rol). No se trae información sensible innecesaria.
  const [rows] = await pool.query(
    'SELECT id_usuario_trab, user_name, password_hash, cargo, correo FROM usuario_trab WHERE user_name = ?',
    [userName]
  );
  // rows es un array de objetos; rows[0] es el primer (y único) resultado esperado.
  // Si no existe ningún usuario con ese nombre, rows estará vacío y rows[0] será undefined,
  // por lo que se retorna null para facilitar la comprobación en la función que llama.
  return rows[0] || null;
}

// Función principal del servicio de autenticación. Orquesta los tres pasos del login:
// 1. Buscar el usuario en la BD. 2. Verificar la contraseña. 3. Emitir el JWT.
async function login(userName, password) {
  const user = await findUserByUsername(userName);

  // Si el usuario no existe se lanza un error con HTTP 401 Unauthorized.
  // Object.assign adjunta la propiedad "status" al objeto Error estándar de JavaScript,
  // permitiendo que el errorHandler en error.middleware.js use ese código HTTP en la respuesta.
  // IMPORTANTE: el mensaje es intencionalmente genérico ("Credenciales incorrectas") tanto
  // para usuario inexistente como para contraseña incorrecta. Si se diferenciaran los mensajes,
  // un atacante podría descubrir qué nombres de usuario existen en el sistema (enumeración de usuarios).
  if (!user) {
    throw Object.assign(new Error('Credenciales incorrectas.'), { status: 401 });
  }

  // bcrypt.compare() toma la contraseña en texto plano que envió el cliente y el hash
  // almacenado en la BD, y recalcula el proceso de hashing para ver si coinciden.
  // Esta operación es deliberadamente lenta (el coste de bcrypt) para resistir ataques.
  // Devuelve true si la contraseña es correcta, false si no lo es.
  // NUNCA se debe comparar contraseñas con === porque el hash incluye una "sal" (salt)
  // aleatoria que hace que el mismo texto produzca hashes distintos en cada llamada.
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    // Mismo mensaje genérico que para usuario no encontrado (ver comentario anterior).
    throw Object.assign(new Error('Credenciales incorrectas.'), { status: 401 });
  }

  // El payload es el conjunto de datos que se codifican dentro del JWT.
  // Se incluyen solo los campos mínimos necesarios para que los middlewares y
  // controladores identifiquen al usuario sin consultar la BD en cada petición:
  //   id       → clave primaria del usuario, necesaria para consultas específicas.
  //   user_name → nombre visible, útil para mostrarlo en la interfaz.
  //   cargo    → rol del usuario (administrador, vendedor, etc.), permite que el
  //              middleware de autorización restrinja rutas según el rol sin ir a la BD.
  // NO se incluye password_hash ni datos sensibles: el payload es solo Base64,
  // cualquiera puede decodificarlo aunque no pueda alterarlo sin invalidar la firma.
  const payload = {
    id: user.id_usuario_trab,
    user_name: user.user_name,
    cargo: user.cargo,
  };

  // jwt.sign() crea el token firmando el payload con JWT_SECRET (clave secreta del servidor).
  // expiresIn: '8h' agrega automáticamente el campo "exp" al payload con la marca de tiempo
  // de expiración (8 horas desde ahora). Una vez vencido, jwt.verify() en auth.middleware.js
  // rechazará el token aunque la firma sea válida, obligando al usuario a autenticarse de nuevo.
  // El valor de JWT_SECRET debe ser largo, aleatorio y mantenerse en secreto en .env;
  // si se compromete, cualquiera podría forjar tokens válidos.
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  // Se retornan el token, el payload como objeto "user" y el correo del usuario
  // para que el controlador pueda enviar el código de verificación sin otra consulta a BD.
  return { token, user: payload, correo: user.correo };
}

// Busca un usuario por su PK y emite un JWT. Lo usa el handler verifyCode del
// controlador una vez que el código de verificación ha sido validado, para no
// tener que volver a pedir user_name y password al cliente.
async function generateTokenForUser(id) {
  const [rows] = await pool.query(
    'SELECT id_usuario_trab, user_name, cargo FROM usuario_trab WHERE id_usuario_trab = ?',
    [id]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });

  const payload = { id: user.id_usuario_trab, user_name: user.user_name, cargo: user.cargo };
  const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  return { token, user: payload };
}

// ── Verificación en dos pasos ────────────────────────────────────────────────

// Almacén en memoria: clave = id_usuario_trab, valor = { codigo, expira }.
// Se usa un Map y no la BD para evitar escrituras innecesarias y porque los
// códigos son efímeros: no importa si se pierden al reiniciar el proceso.
const codigosTemporales = new Map();

// Devuelve un número aleatorio de 6 dígitos como string con ceros a la izquierda.
// Math.random() produce [0, 1); multiplicar por 1_000_000 da [0, 1000000).
// padStart garantiza exactamente 6 caracteres (p. ej. "004271").
function generateCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

// Almacena el código en el Map codigosTemporales asociado al id del usuario.
// La marca de expiración se calcula como la hora actual más 10 minutos en milisegundos
// (10 * 60 * 1000 = 600 000 ms), de modo que verifyCode pueda compararla con Date.now()
// para rechazar códigos que ya superaron ese límite temporal.
function saveCode(id, codigo) {
  codigosTemporales.set(id, {
    codigo,
    expira: Date.now() + 10 * 60 * 1000,
  });
}

// Retorna true si el código existe, no ha expirado y coincide; false en cualquier
// otro caso. Si la validación pasa, elimina la entrada para que el código sea
// de un solo uso y no pueda reutilizarse tras el login exitoso.
function verifyCode(id, codigo) {
  const entry = codigosTemporales.get(id);
  if (!entry) return false;
  if (Date.now() > entry.expira) {
    codigosTemporales.delete(id);
    return false;
  }
  if (entry.codigo !== codigo) return false;
  codigosTemporales.delete(id);
  return true;
}

// Solo se exporta "login"; "findUserByUsername" permanece privada al módulo.
module.exports = { login, generateCode, saveCode, verifyCode, generateTokenForUser };
