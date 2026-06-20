// Servicio que gestiona el registro único de configuración del negocio.
// La tabla "negocio" sigue un patrón singleton: siempre contiene exactamente una fila
// con id_negocio = 1. Por eso no hay getAll, create ni remove: las operaciones se
// reducen a leer esa fila o actualizarla. No se usan transacciones porque cada
// operación afecta una sola tabla con una sola fila.
const { pool } = require('../config/db');

// Retorna el registro único del negocio consultando la primera fila de la tabla.
// SELECT * es aceptable aquí porque la tabla negocio no tiene columnas sensibles
// y el controlador necesita todos sus campos para mostrárselos al usuario.
// LIMIT 1 hace la consulta eficiente y deja claro que se espera como máximo un resultado.
// rows[0] es undefined si la tabla está vacía; || null garantiza retornar null explícito
// para que el controlador pueda generar una respuesta 404 sin lógica adicional.
async function get() {
  const [rows] = await pool.query('SELECT * FROM negocio LIMIT 1');
  return rows[0] || null;
}

// Actualiza todos los campos del registro único del negocio.
// La PK id_negocio = 1 está codificada en el WHERE porque la tabla siempre tiene una
// sola fila; no se recibe id como parámetro porque no hay ambigüedad de registro.
// A diferencia de otros servicios que retornan el registro actualizado con un getById,
// aquí se retorna el resultado crudo del pool.query() para que el controlador pueda
// leer affectedRows y detectar si la fila existe (affectedRows === 0 → tabla vacía).
async function update(data) {
  const { nombre, nit, direccion, telefono, correo, logo_url } = data;
  const [result] = await pool.query(
    `UPDATE negocio
     SET nombre = ?, nit = ?, direccion = ?, telefono = ?, correo = ?, logo_url = ?
     WHERE id_negocio = 1`,
    [nombre, nit, direccion, telefono, correo, logo_url]
  );
  return result;
}

module.exports = { get, update };
