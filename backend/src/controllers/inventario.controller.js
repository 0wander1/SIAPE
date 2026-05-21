// El controlador valida la entrada HTTP y delega la lógica al servicio.
// No contiene consultas SQL ni reglas de negocio: esa responsabilidad es del servicio.
const inventarioService = require('../services/inventario.service');

// Devuelve todos los registros de inventario con nombre de producto y bodega.
// Un array vacío es una respuesta 200 válida; no se mapea a 404.
async function getAll(req, res, next) {
  try {
    const registros = await inventarioService.getAll();
    return res.status(200).json(registros);
  } catch (error) {
    next(error);
  }
}

// Devuelve un registro específico por su PK (req.params.id viene del segmento ":id" de la URL).
// El servicio retorna null si no existe, y aquí se convierte en respuesta 404.
async function getById(req, res, next) {
  try {
    const registro = await inventarioService.getById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: 'Registro de inventario no encontrado.' });
    }
    return res.status(200).json(registro);
  } catch (error) {
    next(error);
  }
}

// Crea un registro de inventario individual a partir del cuerpo JSON.
async function create(req, res, next) {
  try {
    const { cantidad_disponible, producto_id_producto, bodega_id_bodega } = req.body;

    // cantidad_disponible se compara con undefined en lugar de usar !cantidad_disponible
    // porque el valor 0 es falsy en JavaScript pero es una cantidad de stock válida.
    // producto_id_producto y bodega_id_bodega son FKs enteras; cualquier valor falsy
    // (0, null, undefined) indica que el campo no se envió correctamente.
    if (cantidad_disponible === undefined || !producto_id_producto || !bodega_id_bodega) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: cantidad_disponible, producto_id_producto, bodega_id_bodega.',
      });
    }

    // Se pasa req.body completo para que el servicio también reciba los campos opcionales
    // (cantidad_reservada, cantidad_minima) si el cliente los envió.
    const nuevo = await inventarioService.create(req.body);
    // HTTP 201 Created: se generó un nuevo recurso en la BD.
    return res.status(201).json({ message: 'Registro de inventario creado exitosamente.', inventario: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza uno o varios campos del registro identificado por req.params.id.
// No valida campos específicos porque la actualización puede ser parcial;
// la lista blanca de campos permitidos se controla en el servicio.
async function update(req, res, next) {
  try {
    const actualizado = await inventarioService.update(req.params.id, req.body);
    // El servicio retorna null cuando affectedRows === 0, indicando que el id no existe.
    if (!actualizado) {
      return res.status(404).json({ message: 'Registro de inventario no encontrado.' });
    }
    return res.status(200).json({ message: 'Inventario actualizado exitosamente.', inventario: actualizado });
  } catch (error) {
    next(error);
  }
}

// Elimina el registro de inventario y su producto asociado en una sola transacción.
// id_inventario proviene de req.params.id; producto_id_producto debe enviarse en el body.
async function remove(req, res, next) {
  try {
    const { producto_id_producto } = req.body;

    if (!producto_id_producto) {
      return res.status(400).json({ message: 'Falta el campo requerido: producto_id_producto.' });
    }

    await inventarioService.removeConProducto(req.params.id, producto_id_producto);
    return res.status(200).json({ message: 'Producto e inventario eliminados exitosamente.' });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

// Procesa la carga masiva de inventario enviada desde el front-end tras leer un archivo Excel.
// El front-end convierte el Excel a un array JSON (una fila del Excel = un objeto del array)
// y lo envía como cuerpo de este POST. El servicio itera cada objeto y ejecuta la lógica
// de "buscar o crear producto" + "insertar o actualizar inventario" por fila.
async function cargaMasiva(req, res, next) {
  try {
    const filas = req.body;

    // Se valida que el body sea un array con al menos un elemento.
    // Array.isArray() descarta objetos, strings o null que también podrían llegar.
    if (!Array.isArray(filas) || filas.length === 0) {
      return res.status(400).json({ message: 'El cuerpo debe ser un array de filas no vacío.' });
    }

    // El servicio procesa cada fila de forma independiente: los errores de filas individuales
    // no abortan el proceso completo, sino que se acumulan en el array "errores" del resultado.
    // Por eso se responde 200 aunque algunas filas hayan fallado; el cliente puede revisar el resumen.
    const resultado = await inventarioService.cargaMasiva(filas);
    return res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove, cargaMasiva };
