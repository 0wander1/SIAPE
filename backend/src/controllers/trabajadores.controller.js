// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No ejecuta consultas SQL, no genera hashes ni maneja transacciones.
const trabajadoresService = require('../services/trabajadores.service');

// Devuelve todos los trabajadores con columnas públicas. Un array vacío es 200 válido.
async function getAll(req, res, next) {
  try {
    const trabajadores = await trabajadoresService.getAll();
    return res.status(200).json(trabajadores);
  } catch (error) {
    next(error);
  }
}

// Busca un trabajador por su PK (req.params.id). El servicio excluye password_hash
// y salt de la respuesta. Retorna 404 si el trabajador no existe.
async function getById(req, res, next) {
  try {
    const trabajador = await trabajadoresService.getById(req.params.id);
    if (!trabajador) {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(200).json(trabajador);
  } catch (error) {
    next(error);
  }
}

// Crea un nuevo trabajador. Valida que los tres campos obligatorios estén presentes
// antes de invocar al servicio, que hasheará la contraseña y ejecutará la transacción
// de dos inserciones (usuario → usuario_trab).
async function create(req, res, next) {
  try {
    const { cargo, user_name, password } = req.body;

    // Los tres campos son obligatorios; ! es suficiente porque cadena vacía,
    // null o undefined son igualmente inválidos para cargo, user_name y password.
    // La contraseña NO se valida en cuanto a longitud o complejidad aquí:
    // esa responsabilidad podría añadirse sin cambiar el servicio.
    if (!cargo || !user_name || !password) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: cargo, user_name, password.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba también los opcionales
    // (direccion, turno, celular) sin necesidad de enumerarlos en el controlador.
    const nuevo = await trabajadoresService.create(req.body);
    // HTTP 201 Created: se generaron filas nuevas en dos tablas (usuario y usuario_trab).
    return res.status(201).json({ message: 'Trabajador creado exitosamente.', trabajador: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza un trabajador. El servicio detecta automáticamente el modo de operación
// según los campos del body: cambio de contraseña o actualización de perfil.
async function update(req, res, next) {
  try {
    const actualizado = await trabajadoresService.update(req.params.id, req.body);
    // null del servicio indica que el trabajador no existe en BD (affectedRows === 0).
    if (!actualizado) {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(200).json({ message: 'Trabajador actualizado exitosamente.', trabajador: actualizado });
  } catch (error) {
    // El error 401 lo lanza el servicio exclusivamente cuando la contraseña actual
    // proporcionada no coincide con el hash almacenado. Se captura explícitamente aquí
    // para devolver una respuesta 401 Unauthorized con el mensaje descriptivo, en lugar
    // de delegarlo al errorHandler genérico que usaría su propio mensaje.
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
}

// Elimina un trabajador por su PK. Retorna 404 si no existía.
async function remove(req, res, next) {
  try {
    const eliminado = await trabajadoresService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(200).json({ message: 'Trabajador eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
