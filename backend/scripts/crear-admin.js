'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const readline = require('readline');
const bcrypt   = require('bcryptjs');
const mysql    = require('mysql2/promise');

// ─── Helpers de entrada ───────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function preguntar(texto) {
  return new Promise((resolve) => rl.question(texto, (r) => resolve(r.trim())));
}

/** Solicita la contraseña sin mostrarla en pantalla. */
function preguntarPassword(texto) {
  return new Promise((resolve) => {
    // Suprimir el eco de readline mientras dure esta pregunta
    rl._writeToOutput = () => {};

    rl.question(texto, (respuesta) => {
      // Restaurar salida normal
      rl._writeToOutput = (s) => { if (rl.output) rl.output.write(s); };
      process.stdout.write('\n');
      resolve(respuesta.trim());
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║    Crear Usuario Administrador     ║');
  console.log('╚════════════════════════════════════╝\n');

  const user_name = await preguntar('user_name                : ');
  const password  = await preguntarPassword('password  (oculto)       : ');
  const cargo     = await preguntar('cargo                    : ');
  const direccion = await preguntar('dirección (opcional)     : ');
  const turno     = await preguntar('turno  (Mañana/Tarde/…)  : ');
  const celular   = await preguntar('celular   (opcional)     : ');

  rl.close();

  if (!user_name || !password || !cargo) {
    console.error('\nError: user_name, password y cargo son obligatorios.\n');
    process.exit(1);
  }

  // ── Hash de la contraseña ──────────────────────────────────────────────────
  process.stdout.write('\nHasheando contraseña...');
  const salt          = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);
  console.log(' listo.');

  // ── Conexión a la base de datos ───────────────────────────────────────────
  process.stdout.write('Conectando a la base de datos...');
  const conn = await mysql.createConnection({
    host    : process.env.DB_HOST,
    user    : process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port    : Number(process.env.DB_PORT) || 3306,
  });
  console.log(' listo.');

  try {
    const [result] = await conn.execute(
      `INSERT INTO usuario_trab
         (cargo, direccion, turno, celular, user_name, password_hash, salt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cargo,
        direccion || null,
        turno     || null,
        celular   || null,
        user_name,
        password_hash,
        salt,
      ]
    );

    console.log('\n✔ Administrador creado exitosamente.');
    console.log(`  ID generado : ${result.insertId}`);
    console.log(`  user_name   : ${user_name}`);
    console.log(`  cargo       : ${cargo}\n`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  if (err.code === 'ER_DUP_ENTRY') {
    console.error('\nError: El user_name ya existe en la base de datos.\n');
  } else {
    console.error(`\nError: ${err.message}\n`);
  }
  process.exit(1);
});
