const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// Correo único por ejecución para no colisionar con datos existentes.
const TEST_EMAIL = `jest.cliente.${Date.now()}@test.com`;

let token;
let idCreado; // PK del cliente creado en POST, reutilizado en PUT y DELETE 200.

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
  jest.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/clientes
// ─────────────────────────────────────────────
describe('GET /api/clientes', () => {
  test('retorna 200 con array de clientes', async () => {
    const res = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id_usuario_cli');
      expect(res.body[0]).toHaveProperty('nombre_usuario');
      expect(res.body[0]).toHaveProperty('correo');
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/clientes/:id
// ─────────────────────────────────────────────
describe('GET /api/clientes/:id', () => {
  test('retorna 200 con ID existente (ID 1)', async () => {
    const res = await request(app)
      .get('/api/clientes/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_usuario_cli', 1);
    expect(res.body).toHaveProperty('nombre_usuario');
    expect(res.body).toHaveProperty('correo');
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/clientes/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Cliente no encontrado.');
  });
});

// ─────────────────────────────────────────────
// POST /api/clientes
// ─────────────────────────────────────────────
describe('POST /api/clientes', () => {
  test('retorna 201 con datos válidos', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_usuario: 'Cliente Jest Test',
        correo:         TEST_EMAIL,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Cliente creado exitosamente.');
    expect(res.body.cliente).toHaveProperty('id_usuario_cli');
    expect(res.body.cliente.nombre_usuario).toBe('Cliente Jest Test');
    expect(res.body.cliente.correo).toBe(TEST_EMAIL);

    idCreado = res.body.cliente.id_usuario_cli;
  });
});

// ─────────────────────────────────────────────
// PUT /api/clientes/:id
// ─────────────────────────────────────────────
describe('PUT /api/clientes/:id', () => {
  test('retorna 200 actualizando el cliente creado', async () => {
    const res = await request(app)
      .put(`/api/clientes/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_usuario: 'Cliente Jest Actualizado',
        correo:         `jest.actualizado.${Date.now()}@test.com`,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cliente actualizado exitosamente.');
    expect(res.body.cliente.nombre_usuario).toBe('Cliente Jest Actualizado');
    expect(res.body.cliente).toHaveProperty('id_usuario_cli', idCreado);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/clientes/:id
// ─────────────────────────────────────────────
describe('DELETE /api/clientes/:id', () => {
  test('retorna 409 con cliente que tiene facturas (ID 1)', async () => {
    // El servicio cuenta filas en pedido_externo para el cliente antes del DELETE.
    // Si tiene pedidos asociados lanza 409 con este mensaje exacto sin punto final.
    const res = await request(app)
      .delete('/api/clientes/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'No se puede eliminar el cliente porque tiene pedidos asociados'
    );
  });

  test('retorna 200 eliminando el cliente creado', async () => {
    const res = await request(app)
      .delete(`/api/clientes/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cliente eliminado exitosamente.');
  });
});
