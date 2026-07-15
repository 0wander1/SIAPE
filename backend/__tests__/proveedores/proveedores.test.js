const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// NIT único por ejecución para no colisionar con datos existentes.
const TEST_NIT = `NIT_JEST_${Date.now()}`;

let token;
let adminId;
let productoId; // ID de producto existente para productos_asociados.
let idCreado;   // ID del proveedor creado en el test POST 201.

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

  // Obtiene el primer producto disponible para usarlo en productos_asociados.
  // Si la tabla estuviera vacía el test de POST 201 falla con FK error, lo que
  // indica un problema de datos en el entorno, no en el código bajo prueba.
  const [rows] = await pool.query('SELECT id_producto FROM producto LIMIT 1');
  productoId = rows[0]?.id_producto;
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/proveedores
// ─────────────────────────────────────────────
describe('GET /api/proveedores', () => {
  test('retorna 200 con array de proveedores', async () => {
    const res = await request(app)
      .get('/api/proveedores')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/proveedores/:id
// ─────────────────────────────────────────────
describe('GET /api/proveedores/:id', () => {
  test('retorna 200 con ID existente (ID 3)', async () => {
    const res = await request(app)
      .get('/api/proveedores/3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_proveedor', 3);
    expect(res.body).toHaveProperty('nombre_proveedor');
    expect(res.body).toHaveProperty('NIT');
    expect(res.body).toHaveProperty('productos_asociados');
    expect(Array.isArray(res.body.productos_asociados)).toBe(true);
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/proveedores/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Proveedor no encontrado.');
  });
});

// ─────────────────────────────────────────────
// POST /api/proveedores
// ─────────────────────────────────────────────
describe('POST /api/proveedores', () => {
  test('retorna 201 con datos válidos incluyendo productos_asociados', async () => {
    const res = await request(app)
      .post('/api/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_proveedor:    'Proveedor Jest Test',
        NIT:                 TEST_NIT,
        id_usuario_trab:     adminId,
        productos_asociados: [
          {
            producto_id_producto: productoId,
            precio_compra:        15000,
            esPrincipal:          false,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Proveedor creado exitosamente.');
    expect(res.body.proveedor).toHaveProperty('id_proveedor');
    expect(res.body.proveedor.NIT).toBe(TEST_NIT);
    expect(Array.isArray(res.body.proveedor.productos_asociados)).toBe(true);
    expect(res.body.proveedor.productos_asociados).toHaveLength(1);

    idCreado = res.body.proveedor.id_proveedor;
  });

  test('retorna 409 con NIT duplicado', async () => {
    const res = await request(app)
      .post('/api/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_proveedor: 'Proveedor Duplicado',
        NIT:              TEST_NIT, // mismo NIT del test anterior
        id_usuario_trab:  adminId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Ya existe un proveedor con ese NIT.');
  });
});

// ─────────────────────────────────────────────
// DELETE /api/proveedores/:id
// ─────────────────────────────────────────────
describe('DELETE /api/proveedores/:id', () => {
  test('retorna 409 cuando tiene pedidos asociados (ID 7)', async () => {
    const res = await request(app)
      .delete('/api/proveedores/7')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'No se puede eliminar el proveedor porque tiene pedidos asociados.'
    );
  });

  test('retorna 200 con el proveedor creado en el test', async () => {
    const res = await request(app)
      .delete(`/api/proveedores/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Proveedor eliminado exitosamente.');
  });
});
