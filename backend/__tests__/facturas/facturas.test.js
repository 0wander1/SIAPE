const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// numero_factura debe ser único (índice UNIQUE en BD).
const NUMERO_FACTURA = `JEST-${Date.now()}`;

let token;
let adminId;
let clienteId;  // Obtenido dinámicamente de la BD.
let productoId; // Producto con stock ≥ 1 en inventario para el descuento de la venta directa.
let idCreado;   // PK de la factura creada en POST, reutilizado en PUT y DELETE.

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

  // Primer cliente disponible como FK opcional de la factura.
  const [cliRows] = await pool.query(
    'SELECT id_usuario_cli FROM cliente LIMIT 1'
  );
  clienteId = cliRows[0]?.id_usuario_cli;

  // Producto con al menos 1 unidad disponible en inventario.
  // El servicio valida stock con FOR UPDATE antes de descontar; sin stock lanza 400.
  const [prodRows] = await pool.query(`
    SELECT p.id_producto
    FROM producto p
    JOIN inventario i ON i.producto_id_producto = p.id_producto
    WHERE i.cantidad_disponible >= 1
    LIMIT 1
  `);
  productoId = prodRows[0]?.id_producto;
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/facturas
// ─────────────────────────────────────────────
describe('GET /api/facturas', () => {
  test('retorna 200 con array de facturas', async () => {
    const res = await request(app)
      .get('/api/facturas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/facturas/:id
// ─────────────────────────────────────────────
describe('GET /api/facturas/:id', () => {
  test('retorna 200 con ID existente (ID 16) incluyendo items', async () => {
    const res = await request(app)
      .get('/api/facturas/16')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_factura', 16);
    expect(res.body).toHaveProperty('numero_factura');
    expect(res.body).toHaveProperty('subtotal');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('estado');
    // getById siempre adjunta items[], incluso si la factura no tiene ítems (array vacío).
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    if (res.body.items.length > 0) {
      expect(res.body.items[0]).toHaveProperty('producto_id_producto');
      expect(res.body.items[0]).toHaveProperty('cantidad');
      expect(res.body.items[0]).toHaveProperty('valor_unitario');
      expect(res.body.items[0]).toHaveProperty('nombre_producto');
    }
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/facturas/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Factura no encontrada.');
  });
});

// ─────────────────────────────────────────────
// POST /api/facturas
// ─────────────────────────────────────────────
describe('POST /api/facturas', () => {
  test('retorna 201 con datos válidos incluyendo cliente y productos', async () => {
    // Modo B (venta directa): sin pedido_id_pedido, con array productos.
    // El servicio bloquea la fila de inventario con FOR UPDATE, verifica stock
    // y descuenta las unidades antes de insertar la factura y sus ítems.
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     NUMERO_FACTURA,
        fecha_emision:      new Date().toISOString().split('T')[0],
        fecha_vencimiento:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal:           10000,
        impuesto:           1900,
        descuento:          0,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             1,
            valor_unitario:       10000,
          },
        ],
      });

    console.log('Response body:', JSON.stringify(res.body));
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Factura creada exitosamente.');
    expect(res.body.factura).toHaveProperty('id_factura');
    expect(res.body.factura.numero_factura).toBe(NUMERO_FACTURA);
    // total = subtotal + impuesto - descuento = 10000 + 1900 - 0 = 11900
    expect(Number(res.body.factura.total)).toBe(11900);
    expect(res.body.factura).toHaveProperty('items');
    expect(res.body.factura.items).toHaveLength(1);

    idCreado = res.body.factura.id_factura;
  });

  test('retorna 400 sin productos en venta directa', async () => {
    // Sin pedido_id_pedido y con productos vacío: el servicio lanza error status 400
    // antes de abrir transacción. El controlador lo propaga al errorHandler → 400.
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:  `JEST-NOPROD-${Date.now()}`,
        fecha_emision:   new Date().toISOString().split('T')[0],
        subtotal:        5000,
        estado:          'pendiente',
        usuario_trab_id: adminId,
        productos:       [],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Para venta directa se requiere al menos un producto'
    );
  });
});

// ─────────────────────────────────────────────
// PUT /api/facturas/:id
// ─────────────────────────────────────────────
describe('PUT /api/facturas/:id', () => {
  test('retorna 200 actualizando estado de la factura creada', async () => {
    const res = await request(app)
      .put(`/api/facturas/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'pagada' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Factura actualizada exitosamente.');
    expect(res.body.factura.estado).toBe('pagada');
    expect(res.body.factura).toHaveProperty('items');
  });
});

// ─────────────────────────────────────────────
// DELETE /api/facturas/:id
// ─────────────────────────────────────────────
describe('DELETE /api/facturas/:id', () => {
  test('retorna 200 eliminando la factura creada', async () => {
    // factura_item tiene ON DELETE CASCADE sobre factura, por lo que los ítems
    // se eliminan automáticamente al borrar la factura sin error de FK.
    const res = await request(app)
      .delete(`/api/facturas/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Factura eliminada exitosamente.');
  });
});
