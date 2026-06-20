// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No contiene consultas SQL ni reglas de negocio.
// La tabla "negocio" almacena un único registro (id_negocio = 1) con los datos
// de la empresa: nombre, NIT, dirección, teléfono, correo y logo.
const negocioService = require('../services/negocio.service');

// Devuelve el registro único del negocio. No requiere parámetros de entrada porque
// el servicio consulta directamente la fila con id_negocio = 1 usando LIMIT 1.
// Si la fila no existe (BD vacía o sin inicializar) el servicio retorna null → 404.
async function get(req, res, next) {
  try {
    const negocio = await negocioService.get();
    if (!negocio) {
      return res.status(404).json({ message: 'Negocio no encontrado.' });
    }
    return res.status(200).json(negocio);
  } catch (error) {
    next(error);
  }
}

// Actualiza los datos del negocio. Valida la presencia de los dos campos obligatorios
// antes de invocar al servicio, que ejecuta UPDATE WHERE id_negocio = 1.
// Los demás campos (direccion, telefono, correo, logo_url) son opcionales: si no se
// envían en el body se almacenan como null o se mantiene el valor anterior según
// si se envían explícitamente o se omiten.
async function update(req, res, next) {
  try {
    const { nombre, nit, direccion, telefono, correo, logo_url } = req.body;

    // nombre y nit son obligatorios porque identifican legalmente al negocio;
    // los demás campos son opcionales y pueden quedar en null sin problema.
    if (!nombre || !nit) {
      return res.status(400).json({ message: 'Faltan campos requeridos: nombre, nit.' });
    }

    // Se desestructuran los seis campos del body en lugar de pasar req.body completo
    // para que el servicio no reciba propiedades desconocidas que podrían causar
    // columnas no permitidas en la query si el servicio construyese el SET dinámicamente.
    const result = await negocioService.update({ nombre, nit, direccion, telefono, correo, logo_url });

    // A diferencia de otros servicios que retornan null, negocio.service devuelve el
    // resultado crudo del pool.query(); por eso la comprobación de existencia se hace
    // aquí leyendo affectedRows en lugar de comprobar si el retorno es null.
    // affectedRows === 0 significa que WHERE id_negocio = 1 no coincidió con ninguna
    // fila, lo que indica que la tabla negocio está vacía y el registro no existe.
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Negocio no encontrado.' });
    }

    return res.status(200).json({ message: 'Negocio actualizado correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { get, update };
