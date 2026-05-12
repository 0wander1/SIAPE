// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No ejecuta consultas SQL ni gestiona transacciones: esa responsabilidad es del servicio.
const clientesService = require('../services/clientes.service');

// Devuelve todos los clientes. Un array vacío es una respuesta 200 válida.
async function getAll(req, res, next) {
  try {
    const clientes = await clientesService.getAll();
    return res.status(200).json(clientes);
  } catch (error) {
    next(error);
  }
}

// Busca un cliente por su PK extraída de req.params.id.
// El servicio retorna null si el cliente no existe; aquí se convierte en 404.
async function getById(req, res, next) {
  try {
    const cliente = await clientesService.getById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    return res.status(200).json(cliente);
  } catch (error) {
    next(error);
  }
}

// Crea un nuevo cliente. Solo valida la presencia de los dos campos obligatorios;
// el servicio se encarga de insertar en las dos tablas (usuario y cliente) mediante
// una transacción que garantiza la atomicidad de la operación.
async function create(req, res, next) {
  try {
    console.log(req.body);
    const { nombre_usuario, correo } = req.body;

    // Ambos campos son strings; ! es suficiente porque una cadena vacía también
    // debería rechazarse (un cliente sin nombre o sin correo no es válido).
    if (!nombre_usuario || !correo) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_usuario, correo.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba cualquier campo adicional
    // que pueda incorporarse en el futuro sin cambiar la firma del controlador.
    const nuevo = await clientesService.create(req.body);
    // HTTP 201 Created: indica que se generaron nuevas filas en BD (en dos tablas).
    return res.status(201).json({ message: 'Cliente creado exitosamente.', cliente: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza nombre_usuario y/o correo del cliente identificado por req.params.id.
// No valida campos específicos aquí porque el update es parcial: el servicio
// comprueba que al menos uno de los dos campos venga en el body antes de actuar.
async function update(req, res, next) {
  try {
    const actualizado = await clientesService.update(req.params.id, req.body);
    // El servicio retorna null cuando el getById posterior no encuentra al cliente,
    // lo que ocurre si el id no existía en BD. El controlador lo convierte en 404.
    if (!actualizado) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ message: 'Cliente actualizado exitosamente.', cliente: actualizado });
  } catch (error) {
    next(error);
  }
}

// Elimina un cliente por su PK. El servicio verifica primero si tiene pedidos
// asociados; si los tiene lanza un error 409 antes de intentar el DELETE.
async function remove(req, res, next) {
  try {
    const eliminado = await clientesService.remove(req.params.id);
    // El servicio retorna false cuando affectedRows === 0 en el DELETE de usuario,
    // lo que indica que el cliente no existía en BD.
    if (!eliminado) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    return res.status(200).json({ message: 'Cliente eliminado exitosamente.' });
  } catch (error) {
    // El error 409 Conflict (cliente con pedidos asociados) se captura explícitamente
    // para devolver su mensaje descriptivo directamente, en lugar de delegarlo al
    // errorHandler genérico que usaría un mensaje menos informativo.
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
