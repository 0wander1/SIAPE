// El controlador es el punto de entrada HTTP para cada operación sobre pedidos.
// Su única responsabilidad es: leer req, validar los datos de entrada, delegar al
// servicio y formatear la respuesta. No contiene lógica de BD ni reglas de negocio.
const pedidosService = require('../services/pedidos.service');

// Devuelve la lista completa de pedidos. No requiere parámetros de entrada.
// El servicio retorna un array (posiblemente vacío) nunca null, por lo que no
// se necesita comprobar 404 aquí: un array vacío es una respuesta 200 válida.
async function getAll(req, res, next) {
  try {
    const pedidos = await pedidosService.getAll();
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

// Devuelve un único pedido identificado por req.params.id (el segmento ":id" de la URL).
// Express extrae el valor dinámico como string; el servicio lo pasa como parámetro
// al query SQL donde el driver lo convierte al tipo correcto.
// Si el servicio retorna null (pedido inexistente) se responde 404 Not Found.
async function getById(req, res, next) {
  try {
    const pedido = await pedidosService.getById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    }
    return res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

// Crea un nuevo pedido externo a partir del cuerpo JSON de la petición.
async function create(req, res, next) {
  try {
    console.log('[pedidos.controller] create req.body:', req.body);

    // Se desestructuran solo los campos obligatorios para validarlos explícitamente.
    // Los campos opcionales (fecha_entrega_estimada, observaciones, etc.) no se validan
    // aquí porque el servicio les asigna null por defecto si no vienen en el body.
    const { cliente_id_usuario_cli, producto_id_producto, cantidad, estado, valor_total, direccion_pedido, usuario_trab_id } = req.body;

    // Validación de presencia de todos los campos requeridos antes de llegar al servicio.
    // valor_total se comprueba con === undefined/null en lugar de !valor_total porque
    // el valor 0 es falsy en JavaScript pero puede ser un monto válido en ciertos contextos.
    if (!cliente_id_usuario_cli || !producto_id_producto || !cantidad || !estado || valor_total === undefined || valor_total === null || !direccion_pedido || !usuario_trab_id) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: cliente_id_usuario_cli, producto_id_producto, cantidad, estado, valor_total, direccion_pedido, usuario_trab_id.',
      });
    }

    // Se pasa req.body completo al servicio para que también reciba los campos opcionales.
    // HTTP 201 Created indica que se generó un nuevo recurso, a diferencia de 200 que
    // solo confirma éxito sin implicar creación.
    const nuevo = await pedidosService.create(req.body);
    return res.status(201).json({ message: 'Pedido creado exitosamente.', pedido: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza un pedido existente con los campos que vengan en el body.
// No exige ningún campo obligatorio porque la actualización puede ser parcial
// (solo cambiar el estado, solo cambiar la dirección, etc.).
// La lista blanca de campos permitidos se controla en el servicio, no aquí.
async function update(req, res, next) {
  try {
    // req.params.id es el ":id" de la URL; req.body son los campos a modificar.
    const actualizado = await pedidosService.update(req.params.id, req.body);

    // El servicio retorna null cuando affectedRows === 0, lo que indica que ninguna
    // fila coincidió con el id proporcionado, es decir, el pedido no existe.
    if (!actualizado) {
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido actualizado exitosamente.', pedido: actualizado });
  } catch (error) {
    next(error);
  }
}

// Elimina un pedido por su id. El servicio verifica primero si tiene una factura
// asociada y, si la tiene, lanza un error con status 409 antes de ejecutar el DELETE.
async function remove(req, res, next) {
  try {
    const eliminado = await pedidosService.remove(req.params.id);

    // El servicio retorna false cuando affectedRows === 0 (pedido no encontrado).
    if (!eliminado) {
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido eliminado exitosamente.' });
  } catch (error) {
    // El error 409 Conflict (pedido con factura asociada) se maneja explícitamente aquí
    // porque requiere una respuesta directa con su mensaje específico, en lugar de
    // delegarlo al errorHandler genérico que usaría un mensaje menos descriptivo.
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
