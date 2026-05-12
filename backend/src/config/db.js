// mysql2/promise es el adaptador de MySQL para Node.js con soporte nativo de Promises,
// lo que permite usar async/await en lugar de callbacks al ejecutar consultas.
const mysql = require('mysql2/promise');

// Un pool de conexiones mantiene un conjunto de conexiones abiertas y reutilizables.
// En lugar de abrir y cerrar una conexión física por cada petición HTTP (costoso en
// tiempo y recursos), el pool presta una conexión disponible y la devuelve al terminar.
// Esto mejora el rendimiento bajo carga concurrente y evita agotar los recursos del servidor MySQL.
const pool = mysql.createPool({
  // Dirección del servidor MySQL. Se lee desde variables de entorno (definidas en .env)
  // para no escribir credenciales directamente en el código fuente.
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Nombre de la base de datos a la que se conectarán todas las consultas del pool.
  database: process.env.DB_NAME,
  // Puerto de MySQL; si la variable de entorno no está definida se usa el puerto estándar 3306.
  port: process.env.DB_PORT || 3306,
  // waitForConnections: true → si todas las conexiones del pool están ocupadas, las nuevas
  // peticiones esperan en cola en lugar de fallar inmediatamente con un error.
  waitForConnections: true,
  // connectionLimit: número máximo de conexiones físicas abiertas simultáneamente.
  // Subir este valor aumenta la concurrencia pero incrementa el consumo en el servidor MySQL.
  connectionLimit: 10,
  // queueLimit: máximo de peticiones en espera cuando el pool está lleno.
  // 0 significa cola ilimitada; peticiones nunca son rechazadas por desbordamiento de cola.
  queueLimit: 0,
});

// Función que verifica que el pool puede comunicarse con el servidor MySQL al arrancar.
// Es async porque pool.getConnection() devuelve una Promise; se espera con await.
async function testConnection() {
  try {
    // Solicita una conexión del pool. Si el servidor no responde o las credenciales
    // son incorrectas, la Promise se rechaza y el flujo salta al bloque catch.
    const connection = await pool.getConnection();
    console.log('Conexión a MySQL establecida correctamente.');
    // release() devuelve la conexión al pool para que pueda ser reutilizada.
    // Es fundamental llamarla siempre; no hacerlo agotaría el pool con conexiones "prestadas".
    connection.release();
  } catch (error) {
    console.error('Error al conectar con MySQL:', error.message);
    // process.exit(1) detiene el proceso de Node con código de error 1.
    // Se usa aquí porque no tiene sentido arrancar el servidor si la BD no está disponible.
    process.exit(1);
  }
}

// Se exportan el pool (para que los modelos y controladores ejecuten consultas)
// y testConnection (para que server.js la llame antes de iniciar el servidor HTTP).
module.exports = { pool, testConnection };
