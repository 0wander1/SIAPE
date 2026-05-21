// El controlador valida los datos de entrada HTTP y delega la lógica de negocio
// al servicio. No contiene consultas SQL ni reglas de dominio.
const productosService = require('../services/productos.service');

// Devuelve todos los productos. Un array vacío es 200 válido; no se convierte en 404.
async function getAll(req, res, next) {
  try {
    const productos = await productosService.getAll();
    return res.status(200).json(productos);
  } catch (error) {
    next(error);
  }
}

// Busca un producto por su PK extraída de req.params.id (segmento ":id" de la URL).
// Si el servicio retorna null (producto inexistente) se responde 404 Not Found.
async function getById(req, res, next) {
  try {
    const producto = await productosService.getById(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json(producto);
  } catch (error) {
    next(error);
  }
}

// Crea un nuevo producto. Valida que los cuatro campos obligatorios estén presentes
// antes de invocar al servicio, que además creará el registro de inventario inicial.
async function create(req, res, next) {
  try {
    console.log(req.body);
    const { nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega } = req.body;

    // valor_neto y valor_de_venta se comparan con == null (que cubre tanto null como
    // undefined) en lugar de !valor porque el valor 0 es falsy en JavaScript pero
    // puede ser un precio legítimo. nombre_producto y bodega_id_bodega se comprueban
    // con ! porque cualquier valor vacío o cero sería inválido para esos campos.
    if (!nombre_producto || valor_neto == null || valor_de_venta == null || !bodega_id_bodega) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega.',
      });
    }

    // Se pasa req.body completo para que el servicio reciba también los campos opcionales:
    // lote, fecha_vencimiento, cantidad y cantidad_minima.
    const nuevo = await productosService.create(req.body);
    // HTTP 201 Created: indica que el servidor generó un nuevo recurso, a diferencia
    // de 200 que solo confirma éxito sin implicar creación de datos.
    return res.status(201).json({ message: 'Producto creado exitosamente.', producto: nuevo });
  } catch (error) {
    next(error);
  }
}

// Actualiza un producto existente. A diferencia del update de inventario (parcial),
// este exige los mismos cuatro campos obligatorios que create para garantizar que
// el registro siempre quede completo tras la edición.
async function update(req, res, next) {
  try {
    const { nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega } = req.body;

    // Misma lógica de validación que en create: == null para precios (permite 0),
    // ! para nombre y bodega (cualquier valor falsy es inválido).
    if (!nombre_producto || valor_neto == null || valor_de_venta == null || !bodega_id_bodega) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre_producto, valor_neto, valor_de_venta, bodega_id_bodega.',
      });
    }

    const actualizado = await productosService.update(req.params.id, req.body);
    // El servicio retorna null cuando affectedRows === 0: el producto no existe en BD.
    if (!actualizado) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json({ message: 'Producto actualizado exitosamente.', producto: actualizado });
  } catch (error) {
    next(error);
  }
}

// Elimina un producto por su PK. El servicio verifica primero si tiene pedidos
// asociados; si los tiene lanza un error 409 antes de ejecutar el DELETE.
async function remove(req, res, next) {
  try {
    const eliminado = await productosService.remove(req.params.id);
    // El servicio retorna false cuando affectedRows === 0 (producto no encontrado).
    if (!eliminado) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json({ message: 'Producto eliminado exitosamente.' });
  } catch (error) {
    // El error 409 Conflict (producto con pedidos asociados) se captura explícitamente
    // aquí para devolver su mensaje descriptivo directamente al cliente, en lugar de
    // delegarlo al errorHandler genérico que usaría un mensaje menos informativo.
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
}

// Retorna los proveedores asociados al producto indicado por :id.
// Un array vacío es una respuesta 200 válida: significa que el producto existe
// pero aún no tiene proveedores vinculados en producto_has_proveedor.
async function getProveedores(req, res, next) {
  try {
    const proveedores = await productosService.getProveedores(req.params.id);
    return res.status(200).json(proveedores);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, create, update, remove, getProveedores };
