// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No ejecuta consultas SQL ni contiene reglas de negocio.
const proveedoresService = require('../services/proveedores.service');

// Devuelve todos los proveedores, cada uno con su array "productos_asociados".
// Un array vacío es una respuesta 200 válida; no se convierte en 404.
async function getAll(req, res, next) {
  try {
    const proveedores = await proveedoresService.getAll();
    return res.status(200).json(proveedores);
  } catch (error) {
    next(error);
  }
}

// Busca un proveedor por su PK (req.params.id viene del segmento ":id" de la URL).
// El servicio retorna null si no existe; aquí se convierte en 404 Not Found.
async function getById(req, res, next) {
  try {
    const proveedor = await proveedoresService.getById(req.params.id);
    if (!proveedor) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json(proveedor);
  } catch (error) {
    next(error);
  }
}

// Crea un nuevo proveedor. Valida la presencia de los tres campos obligatorios
// antes de llegar al servicio, que realizará la verificación de NIT único.
async function create(req, res, next) {
  try {
    const { nombre_proveedor, NIT, id_usuario_trab } = req.body;

    // Los tres campos son obligatorios. Se usa ! porque cualquier valor falsy
    // (string vacío, 0, null, undefined) es inválido para estos campos.
    if (!nombre_proveedor || !NIT || !id_usuario_trab) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_proveedor, NIT, id_usuario_trab.',
      });
    }

    // Se pasa req.body completo para que el servicio acceda a todos los campos,
    // incluyendo cualquier campo opcional que se añada en el futuro.
    const nuevo = await proveedoresService.create(req.body);
    // HTTP 201 Created: indica que se generó un nuevo recurso en la BD.
    // Si el servicio detecta NIT duplicado lanza un error 409 que llega a next(error).
    return res.status(201).json({ message: 'Proveedor creado exitosamente.', proveedor: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza parcialmente el proveedor identificado por req.params.id.
// No valida campos específicos aquí: el servicio filtra el body contra la lista blanca
// y lanza 400 si ningún campo válido está presente, o 409 si el NIT ya existe.
async function update(req, res, next) {
  try {
    const actualizado = await proveedoresService.update(req.params.id, req.body);
    // El servicio retorna null cuando affectedRows === 0: el proveedor no existe en BD.
    if (!actualizado) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Proveedor actualizado exitosamente.', proveedor: actualizado });
  } catch (error) {
    // Cualquier error del servicio (incluido 409 por NIT duplicado en el UPDATE)
    // se delega al errorHandler global, que usa error.status para el código HTTP.
    next(error);
  }
}

// Elimina un proveedor por su PK. El servicio retorna false si no existía (→ 404).
// Si MySQL rechaza el DELETE por restricciones de FK, el error llega a next(error)
// y el errorHandler global lo convierte en una respuesta 500.
async function remove(req, res, next) {
  try {
    const eliminado = await proveedoresService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
