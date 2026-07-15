const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

let token;

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

  token = verifyRes.body.token;
  jwt.verify(token, process.env.JWT_SECRET);
  jest.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/reportes/ventas
// ─────────────────────────────────────────────
describe('GET /api/reportes/ventas', () => {
  test('retorna 200 con fechas válidas y agrupacion=semana', async () => {
    const res = await request(app)
      .get('/api/reportes/ventas')
      .query({ fecha_inicio: '2025-01-01', fecha_fin: '2025-12-31', agrupacion: 'semana' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('periodo');
    expect(res.body).toHaveProperty('resumen');
    expect(res.body).toHaveProperty('por_semana');
    expect(Array.isArray(res.body.por_semana)).toBe(true);
  });

  test('retorna 200 con agrupacion=dia', async () => {
    const res = await request(app)
      .get('/api/reportes/ventas')
      .query({ fecha_inicio: '2025-01-01', fecha_fin: '2025-12-31', agrupacion: 'dia' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('periodo');
    expect(res.body).toHaveProperty('resumen');
    expect(res.body).toHaveProperty('por_semana');
    expect(Array.isArray(res.body.por_semana)).toBe(true);
  });

  test('retorna 400 sin fechas', async () => {
    const res = await request(app)
      .get('/api/reportes/ventas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Los parámetros fecha_inicio y fecha_fin son requeridos (formato: YYYY-MM-DD).'
    );
  });
});

// ─────────────────────────────────────────────
// GET /api/reportes/inventario
// ─────────────────────────────────────────────
describe('GET /api/reportes/inventario', () => {
  test('retorna 200', async () => {
    const res = await request(app)
      .get('/api/reportes/inventario')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_criticos');
    expect(res.body).toHaveProperty('productos');
    expect(Array.isArray(res.body.productos)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/reportes/proveedores
// ─────────────────────────────────────────────
describe('GET /api/reportes/proveedores', () => {
  test('retorna 200', async () => {
    const res = await request(app)
      .get('/api/reportes/proveedores')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/reportes/trabajadores
// ─────────────────────────────────────────────
describe('GET /api/reportes/trabajadores', () => {
  test('retorna 200', async () => {
    const res = await request(app)
      .get('/api/reportes/trabajadores')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/reportes/costos
// ─────────────────────────────────────────────
describe('GET /api/reportes/costos', () => {
  test('retorna 200 con fechas válidas', async () => {
    const res = await request(app)
      .get('/api/reportes/costos')
      .query({ fecha_inicio: '2025-01-01', fecha_fin: '2025-12-31' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('resumen');
    expect(res.body).toHaveProperty('pedidos');
    expect(Array.isArray(res.body.pedidos)).toBe(true);
  });

  test('retorna 400 sin fechas', async () => {
    const res = await request(app)
      .get('/api/reportes/costos')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Los parámetros fecha_inicio y fecha_fin son requeridos (formato: YYYY-MM-DD).'
    );
  });
});
