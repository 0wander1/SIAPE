const bodegasService = require('../services/bodegas.service');

async function getAll(req, res, next) {
  try {
    const bodegas = await bodegasService.getAll();
    return res.status(200).json(bodegas);
  } catch (error) {
    next(error);
  }
}

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

async function create(req, res, next) {
  try {
    const { descripcion, ubicacion, ciudad, capacidad_maxima, tipo_bodega, usuario_trab_id_responsable } = req.body;

    if (!descripcion || !ubicacion || !ciudad || !capacidad_maxima || !tipo_bodega || !usuario_trab_id_responsable) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: descripcion, ubicacion, ciudad, capacidad_maxima, tipo_bodega, usuario_trab_id_responsable.',
      });
    }

    const nueva = await bodegasService.create(req.body);
    return res.status(201).json({ message: 'Bodega creada exitosamente.', bodega: nueva });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const actualizada = await bodegasService.update(req.params.id, req.body);
    if (!actualizada) {
      return res.status(404).json({ message: 'Bodega no encontrada.' });
    }
    return res.status(200).json({ message: 'Bodega actualizada exitosamente.', bodega: actualizada });
  } catch (error) {
    next(error);
  }
}

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
