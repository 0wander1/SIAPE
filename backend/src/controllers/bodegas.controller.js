// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No ejecuta consultas SQL ni contiene reglas de negocio.
const bodegasService = require('../services/bodegas.service');

// Devuelve todas las bodegas. Un array vacío es una respuesta 200 válida.
async function getAll(req, res, next) {
  try {
    const bodegas = await bodegasService.getAll();
    return res.status(200).json(bodegas);
  } catch (error) {
    next(error);
  }
}

// Busca una bodega por su PK (req.params.id viene del segmento ":id" de la URL).
// El servicio retorna null si no existe; aquí se convierte en 404 Not Found.
async function getById(req, res, next) {
  try {
    const bodega = await bodegasService.getById(req.params.id);
    if (!bodega) {
      return res.status(404).json({ message: 'Bodega no encontrada.' });
    }
    return res.status(200).json(bodega);
  } catch (error) {
    next(error);
  }
}

// Crea una nueva bodega validando que todos los campos obligatorios estén presentes.
async function create(req, res, next) {
  try {
    const { descripcion, ubicacion, ciudad, capacidad_maxima, tipo_bodega, usuario_trab_id_responsable } = req.body;

    // Se validan con ! los seis campos obligatorios. capacidad_maxima se comprueba
    // con ! porque un valor 0 o negativo no tendría sentido como capacidad máxima,
    // por lo que cualquier valor falsy (incluido 0) se considera inválido aquí.
    // tipo_bodega es un ENUM en la BD ('principal', 'secundaria', 'transito'); si se
    // envía un valor fuera de ese conjunto MySQL rechazará el INSERT con un error
    // que llegará al errorHandler global. La validación aquí solo comprueba presencia,
    // no el contenido del ENUM, para no duplicar la lógica que ya enforcea la BD.
    if (!descripcion || !ubicacion || !ciudad || !capacidad_maxima || !tipo_bodega || !usuario_trab_id_responsable) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: descripcion, ubicacion, ciudad, capacidad_maxima, tipo_bodega, usuario_trab_id_responsable.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba también los campos opcionales
    // capacidad_actual y activa, que tienen valores por defecto definidos en el servicio.
    const nueva = await bodegasService.create(req.body);
    // HTTP 201 Created: indica que se generó un nuevo registro en la tabla bodega.
    return res.status(201).json({ message: 'Bodega creada exitosamente.', bodega: nueva });
  } catch (error) {
    next(error);
  }
}

// Actualiza parcialmente una bodega. No valida campos específicos aquí porque
// la actualización puede ser parcial; el servicio filtra el body contra la lista
// blanca y lanza 400 si ningún campo válido está presente.
async function update(req, res, next) {
  try {
    const actualizada = await bodegasService.update(req.params.id, req.body);
    // El servicio retorna null cuando affectedRows === 0: la bodega no existe en BD.
    if (!actualizada) {
      return res.status(404).json({ message: 'Bodega no encontrada.' });
    }
    return res.status(200).json({ message: 'Bodega actualizada exitosamente.', bodega: actualizada });
  } catch (error) {
    next(error);
  }
}

// Elimina una bodega por su PK. El servicio retorna false si no existía (→ 404).
// Si MySQL rechaza el DELETE por restricciones de FK el error llega a next(error).
async function remove(req, res, next) {
  try {
    const eliminada = await bodegasService.remove(req.params.id);
    if (!eliminada) {
      return res.status(404).json({ message: 'Bodega no encontrada.' });
    }
    return res.status(200).json({ message: 'Bodega eliminada exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
