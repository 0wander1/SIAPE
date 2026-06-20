// El controlador valida los datos de entrada HTTP y delega la lógica al servicio.
// No contiene consultas SQL, no gestiona transacciones ni incrementa inventario:
// esa responsabilidad pertenece exclusivamente al servicio.
const pedidosProveedorService = require('../services/pedidos-proveedor.service');

// Devuelve todos los pedidos a proveedor con sus items, nombre de proveedor y
// nombre del trabajador responsable. Un array vacío es una respuesta 200 válida;
// no se convierte en 404 porque la ausencia de pedidos es un estado legítimo del sistema.
async function getAll(req, res, next) {
  try {
    const pedidos = await pedidosProveedorService.getAll();
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

// Busca un pedido a proveedor por su PK (req.params.id viene del segmento ":id" de la URL).
// La respuesta incluye el array "items" con los productos y cantidades del pedido.
// El servicio retorna null si el pedido no existe; aquí se convierte en 404 Not Found.
async function getById(req, res, next) {
  try {
    const pedido = await pedidosProveedorService.getById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido a proveedor no encontrado.' });
    }
    return res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

// Crea un pedido a proveedor con sus items. Realiza tres validaciones de presencia
// antes de invocar al servicio, que ejecutará la transacción con los INSERTs y los
// UPDATEs de precio en producto_has_proveedor.
async function create(req, res, next) {
  try {
    const { proveedor_id_proveedor, items } = req.body;

    // proveedor_id_proveedor es la FK al proveedor al que se le hace el pedido;
    // sin ella el pedido no puede vincularse a ningún proveedor en la BD.
    if (!proveedor_id_proveedor) {
      return res.status(400).json({ message: 'El campo proveedor_id_proveedor es requerido.' });
    }

    // Un pedido sin items no tiene sentido: no hay productos que solicitar ni
    // cantidades que recibir. Array.isArray() descarta cualquier valor que no sea array.
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'El pedido debe incluir al menos un item.' });
    }

    // Se valida que cada item tenga los dos campos mínimos necesarios para insertarse
    // en pedido_proveedor_item: la FK del producto y la cantidad a pedir.
    // Array.find() retorna el primer item inválido o undefined si todos son válidos.
    const itemInvalido = items.find((i) => !i.producto_id_producto || !i.cantidad);
    if (itemInvalido) {
      return res.status(400).json({
        message: 'Cada item debe tener producto_id_producto y cantidad.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba también los campos opcionales
    // (usuario_trab_id, estado, valor_total, fecha_estimada, observaciones).
    // HTTP 201 Created indica que se generaron nuevas filas en pedido_proveedor y en
    // pedido_proveedor_item (una por cada elemento del array items).
    const nuevo = await pedidosProveedorService.create(req.body);
    return res.status(201).json({ message: 'Pedido a proveedor creado exitosamente.', pedido: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza los campos de un pedido a proveedor existente.
// Cuando el body incluye estado: 'recibido', el servicio abre una transacción que
// además de actualizar el pedido incrementa el inventario de cada item en la bodega
// indicada por bodega_id. Si el pedido ya estaba en 'recibido', el servicio lanza 409.
// null del servicio indica que el id no existe en BD → 404.
async function update(req, res, next) {
  try {
    const actualizado = await pedidosProveedorService.update(req.params.id, req.body);
    if (!actualizado) {
      return res.status(404).json({ message: 'Pedido a proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido a proveedor actualizado exitosamente.', pedido: actualizado });
  } catch (error) {
    next(error);
  }
}

// Elimina un pedido a proveedor por su PK. El servicio verifica primero si el pedido
// existe y si su estado es 'recibido'; en ese caso lanza un error 409 porque el pedido
// ya afectó el inventario y eliminarlo dejaría el stock inconsistente.
async function remove(req, res, next) {
  try {
    const eliminado = await pedidosProveedorService.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Pedido a proveedor no encontrado.' });
    }
    return res.status(200).json({ message: 'Pedido a proveedor eliminado exitosamente.' });
  } catch (error) {
    // El error 409 Conflict (pedido ya recibido) se captura explícitamente aquí
    // para devolver su mensaje descriptivo directamente al cliente, en lugar de
    // delegarlo al errorHandler genérico que usaría un mensaje menos informativo.
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove };
