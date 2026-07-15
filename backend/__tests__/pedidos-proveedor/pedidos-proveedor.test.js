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
