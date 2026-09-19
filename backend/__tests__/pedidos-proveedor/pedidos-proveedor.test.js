const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

let token;
let adminId;
let proveedorId; // Obtenido dinámicamente; FK requerida en el POST.
let productoId;  // Obtenido dinámicamente; usado en los items del POST.
let idCreado;    // PK del pedido creado en POST, reutilizado en PUT y DELETE 200.

beforeAll(async () => {
  jest.spyOn(authService, 'generateCode').mockReturnValue('123456');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      user_name: 'adminhector',
      password: process.env.TEST_ADMIN_PASSWORD,
    });

  const { userId } = loginRes.body;

  const verifyRes = await request(app)
    .post('/api/auth/verify-code')
    .send({ userId, codigo: '123456' });

  token   = verifyRes.body.token;
  adminId = jwt.verify(token, process.env.JWT_SECRET).id;
  jest.restoreAllMocks();

  // Obtiene el primer proveedor disponible para usarlo como FK del pedido.
  const [provRows] = await pool.query(
    'SELECT id_proveedor FROM proveedor LIMIT 1'
  );
  proveedorId = provRows[0]?.id_proveedor;

  // Obtiene el primer producto disponible para construir el array de items.
  // El servicio actualiza precio en producto_has_proveedor de forma silenciosa
  // si no existe relación, así que cualquier producto válido es suficiente.
  const [prodRows] = await pool.query(
    'SELECT id_producto FROM producto LIMIT 1'
  );
  productoId = prodRows[0]?.id_producto;
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/pedidos-proveedor
// ─────────────────────────────────────────────
describe('GET /api/pedidos-proveedor', () => {
  test('retorna 200 con array de pedidos a proveedor', async () => {
    const res = await request(app)
      .get('/api/pedidos-proveedor')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id_pedido_prov');
      expect(res.body[0]).toHaveProperty('items');
      expect(Array.isArray(res.body[0].items)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/pedidos-proveedor/:id
// ─────────────────────────────────────────────
describe('GET /api/pedidos-proveedor/:id', () => {
  test('retorna 200 con ID existente (ID 16)', async () => {
    const res = await request(app)
      .get('/api/pedidos-proveedor/16')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_pedido_prov', 16);
    expect(res.body).toHaveProperty('proveedor_id_proveedor');
    expect(res.body).toHaveProperty('estado');
    // El servicio usa alias camelCase en el SQL_SELECT.
    expect(res.body).toHaveProperty('valorTotal');
    expect(res.body).toHaveProperty('fechaEstimada');
    expect(res.body).toHaveProperty('nombre_proveedor');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/pedidos-proveedor/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Pedido a proveedor no encontrado.');
  });
});

// ─────────────────────────────────────────────
// POST /api/pedidos-proveedor
// ─────────────────────────────────────────────
describe('POST /api/pedidos-proveedor', () => {
  test('retorna 201 con datos válidos incluyendo items', async () => {
    const res = await request(app)
      .post('/api/pedidos-proveedor')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedor_id_proveedor: proveedorId,
        usuario_trab_id:        adminId,
        estado:                 'pendiente',
        valor_total:            50000,
        observaciones:          'Pedido de prueba Jest',
        items: [
          {
            producto_id_producto: productoId,
            cantidad:             10,
            precio_unitario:      5000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Pedido a proveedor creado exitosamente.');
    expect(res.body.pedido).toHaveProperty('id_pedido_prov');
    expect(res.body.pedido.proveedor_id_proveedor).toBe(proveedorId);
    expect(res.body.pedido.estado).toBe('pendiente');
    expect(Array.isArray(res.body.pedido.items)).toBe(true);
    expect(res.body.pedido.items).toHaveLength(1);
    expect(res.body.pedido.items[0].producto_id_producto).toBe(productoId);

    idCreado = res.body.pedido.id_pedido_prov;
  });

  test('retorna 400 sin items', async () => {
    const res = await request(app)
      .post('/api/pedidos-proveedor')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedor_id_proveedor: proveedorId,
        items: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El pedido debe incluir al menos un item.');
  });

  test('actualiza precio_compra en producto_has_proveedor con el precio_unitario del item', async () => {
    // Usa una relación producto-proveedor ya existente en producto_has_proveedor:
    // el UPDATE del servicio no afecta filas (se ignora silenciosamente) si la
    // relación no existe, así que se necesita una fila real para verificar el efecto.
    const [[relacion]] = await pool.query(
      'SELECT producto_id_producto, proveedor_id_proveedor, precio_compra FROM producto_has_proveedor LIMIT 1'
    );
    const { producto_id_producto, proveedor_id_proveedor, precio_compra: precioOriginal } = relacion;

    const [[productoOriginal]] = await pool.query(
      'SELECT valor_neto FROM producto WHERE id_producto = ?',
      [producto_id_producto]
    );

    // Precio distinto al actual para comprobar que realmente cambia, no que ya coincidía.
    const nuevoPrecio = Number(precioOriginal) + 1234;

    const res = await request(app)
      .post('/api/pedidos-proveedor')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedor_id_proveedor,
        usuario_trab_id: adminId,
        estado:          'pendiente',
        valor_total:     nuevoPrecio * 3,
        items: [
          {
            producto_id_producto,
            cantidad:        3,
            precio_unitario: nuevoPrecio,
          },
        ],
      });

    expect(res.status).toBe(201);
    const pedidoId = res.body.pedido.id_pedido_prov;

    const [[relacionActualizada]] = await pool.query(
      'SELECT precio_compra FROM producto_has_proveedor WHERE producto_id_producto = ? AND proveedor_id_proveedor = ?',
      [producto_id_producto, proveedor_id_proveedor]
    );

    expect(Number(relacionActualizada.precio_compra)).toBe(nuevoPrecio);

    // Limpieza: se elimina el pedido creado y se restauran precio_compra y valor_neto
    // a sus valores originales, ya que el servicio los modifica como efecto colateral
    // (INSERT en producto_has_proveedor y en producto ambos ocurren dentro de create()).
    await pool.query('DELETE FROM pedido_proveedor WHERE id_pedido_prov = ?', [pedidoId]);
    await pool.query(
      'UPDATE producto_has_proveedor SET precio_compra = ? WHERE producto_id_producto = ? AND proveedor_id_proveedor = ?',
      [precioOriginal, producto_id_producto, proveedor_id_proveedor]
    );
    await pool.query(
      'UPDATE producto SET valor_neto = ? WHERE id_producto = ?',
      [productoOriginal.valor_neto, producto_id_producto]
    );
  });
});

// ─────────────────────────────────────────────
// PUT /api/pedidos-proveedor/:id
// ─────────────────────────────────────────────
describe('PUT /api/pedidos-proveedor/:id', () => {
  test('retorna 200 actualizando estado del pedido creado', async () => {
    // Se usa 'confirmado' para no activar la lógica de recepción de inventario,
    // que requiere bodega_id y transacción adicional (reservada para otro test).
    const res = await request(app)
      .put(`/api/pedidos-proveedor/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        estado:        'confirmado',
        observaciones: 'Actualizado por Jest',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Pedido a proveedor actualizado exitosamente.');
    expect(res.body.pedido.estado).toBe('confirmado');
    expect(res.body.pedido.observaciones).toBe('Actualizado por Jest');
  });

  test('el inventario del producto se incrementa al marcar el pedido como recibido', async () => {
    // Usa su propio pedido (no idCreado) para no interferir con el describe de
    // DELETE, que reutiliza el pedido del test anterior.
    const [bodegaRows] = await pool.query('SELECT id_bodega FROM bodega LIMIT 1');
    const bodegaId = bodegaRows[0]?.id_bodega;
    const cantidadPedida = 5;

    const pedidoRes = await request(app)
      .post('/api/pedidos-proveedor')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedor_id_proveedor: proveedorId,
        usuario_trab_id:        adminId,
        estado:                 'pendiente',
        valor_total:            50000,
        items: [
          {
            producto_id_producto: productoId,
            cantidad:             cantidadPedida,
            precio_unitario:      5000,
          },
        ],
      });

    expect(pedidoRes.status).toBe(201);
    const pedidoId = pedidoRes.body.pedido.id_pedido_prov;

    // Se consulta el stock actual (puede no existir fila para este producto+bodega,
    // en cuyo caso el servicio la crea con INSERT ... ON DUPLICATE KEY UPDATE).
    const [beforeRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
      [productoId, bodegaId]
    );
    const stockAntes = beforeRows.length > 0 ? Number(beforeRows[0].cantidad_disponible) : 0;

    const putRes = await request(app)
      .put(`/api/pedidos-proveedor/${pedidoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'recibido', bodega_id: bodegaId });

    expect(putRes.status).toBe(200);
    expect(putRes.body.pedido.estado).toBe('recibido');

    const [afterRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
      [productoId, bodegaId]
    );
    const stockDespues = Number(afterRows[0].cantidad_disponible);

    expect(stockDespues).toBe(stockAntes + cantidadPedida);

    // Limpieza: el pedido queda en estado 'recibido', así que el endpoint DELETE lo
    // rechazaría con 409 (ver describe de DELETE); se elimina directo por SQL, lo que
    // arrastra en cascada sus items. Luego se revierte el incremento de inventario
    // (o se borra la fila si fue creada por este test) para no dejar stock artificial.
    await pool.query('DELETE FROM pedido_proveedor WHERE id_pedido_prov = ?', [pedidoId]);

    if (beforeRows.length > 0) {
      await pool.query(
        'UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
        [cantidadPedida, productoId, bodegaId]
      );
    } else {
      await pool.query(
        'DELETE FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
        [productoId, bodegaId]
      );
    }
  });
});

// ─────────────────────────────────────────────
// Flujo E2E: crear → recibir → verificar inventario → eliminar
// ─────────────────────────────────────────────
describe('Flujo E2E: crear pedido, recibirlo y verificar que no se puede eliminar', () => {
  test('crear pedido → recibido con bodega → inventario actualizado → DELETE retorna 409', async () => {
    const [bodegaRows] = await pool.query('SELECT id_bodega FROM bodega LIMIT 1');
    const bodegaId = bodegaRows[0]?.id_bodega;
    const cantidadPedida = 4;

    // 1. Crear pedido
    const pedidoRes = await request(app)
      .post('/api/pedidos-proveedor')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedor_id_proveedor: proveedorId,
        usuario_trab_id:        adminId,
        estado:                 'pendiente',
        valor_total:            50000,
        items: [
          {
            producto_id_producto: productoId,
            cantidad:             cantidadPedida,
            precio_unitario:      5000,
          },
        ],
      });

    expect(pedidoRes.status).toBe(201);
    const pedidoId = pedidoRes.body.pedido.id_pedido_prov;

    const [beforeRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
      [productoId, bodegaId]
    );
    const stockAntes = beforeRows.length > 0 ? Number(beforeRows[0].cantidad_disponible) : 0;

    // 2. Cambiar estado a recibido
    const putRes = await request(app)
      .put(`/api/pedidos-proveedor/${pedidoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'recibido', bodega_id: bodegaId });

    expect(putRes.status).toBe(200);
    expect(putRes.body.pedido.estado).toBe('recibido');

    // 3. Verificar que el inventario se actualizó
    const [afterRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
      [productoId, bodegaId]
    );
    const stockDespues = Number(afterRows[0].cantidad_disponible);
    expect(stockDespues).toBe(stockAntes + cantidadPedida);

    // 4. Intentar eliminar el pedido ya recibido → 409
    const deleteRes = await request(app)
      .delete(`/api/pedidos-proveedor/${pedidoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.message).toBe('No se puede eliminar un pedido ya recibido');

    // Limpieza: el DELETE del paso 4 fue rechazado (correctamente), así que el pedido
    // sigue existiendo; se elimina directo por SQL (cascada a items) y se revierte
    // el incremento de inventario para no dejar stock artificial.
    await pool.query('DELETE FROM pedido_proveedor WHERE id_pedido_prov = ?', [pedidoId]);

    if (beforeRows.length > 0) {
      await pool.query(
        'UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
        [cantidadPedida, productoId, bodegaId]
      );
    } else {
      await pool.query(
        'DELETE FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
        [productoId, bodegaId]
      );
    }
  });
});

// ─────────────────────────────────────────────
// DELETE /api/pedidos-proveedor/:id
// ─────────────────────────────────────────────
describe('DELETE /api/pedidos-proveedor/:id', () => {
  test('retorna 409 con pedido en estado recibido (ID 3)', async () => {
    const res = await request(app)
      .delete('/api/pedidos-proveedor/3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    // El servicio lanza este mensaje exacto sin punto final.
    expect(res.body.message).toBe('No se puede eliminar un pedido ya recibido');
  });

  test('retorna 200 eliminando el pedido creado', async () => {
    const res = await request(app)
      .delete(`/api/pedidos-proveedor/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Pedido a proveedor eliminado exitosamente.');
  });
});
