const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// descripcion debe ser única (índice UNIQUE en BD).
const DESCRIPCION_BODEGA = `JEST-${Date.now()}`;

let token;
let adminId;
let idCreado; // PK de la bodega creada en POST, reutilizada en PUT y DELETE.

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
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/bodegas
// ─────────────────────────────────────────────
describe('GET /api/bodegas', () => {
  test('retorna 200 con array de bodegas', async () => {
    const res = await request(app)
      .get('/api/bodegas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/bodegas/:id
// ─────────────────────────────────────────────
describe('GET /api/bodegas/:id', () => {
  test('retorna 200 con ID existente (ID 1)', async () => {
    const res = await request(app)
      .get('/api/bodegas/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_bodega', 1);
    expect(res.body).toHaveProperty('descripcion');
    expect(res.body).toHaveProperty('ubicacion');
    expect(res.body).toHaveProperty('ciudad');
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/bodegas/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Bodega no encontrada.');
  });
});

// ─────────────────────────────────────────────
// POST /api/bodegas
// ─────────────────────────────────────────────
describe('POST /api/bodegas', () => {
  test('retorna 201 con datos válidos', async () => {
    const res = await request(app)
      .post('/api/bodegas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        descripcion:                  DESCRIPCION_BODEGA,
        ubicacion:                    'Calle 123',
        ciudad:                       'Cali',
        capacidad_maxima:             500,
        tipo_bodega:                  'general',
        usuario_trab_id_responsable:  adminId,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Bodega creada exitosamente.');
    expect(res.body.bodega).toHaveProperty('id_bodega');
    expect(res.body.bodega.descripcion).toBe(DESCRIPCION_BODEGA);

    idCreado = res.body.bodega.id_bodega;
  });

  test('retorna 409 con nombre duplicado ("Bodega Principal")', async () => {
    const res = await request(app)
      .post('/api/bodegas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        descripcion:                  'Bodega Principal',
        ubicacion:                    'Calle 456',
        ciudad:                       'Medellín',
        capacidad_maxima:             500,
        tipo_bodega:                  'general',
        usuario_trab_id_responsable:  adminId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Ya existe una bodega con ese nombre.');
  });
});

// ─────────────────────────────────────────────
// PUT /api/bodegas/:id
// ─────────────────────────────────────────────
describe('PUT /api/bodegas/:id', () => {
  test('retorna 200 actualizando la bodega creada', async () => {
    const res = await request(app)
      .put(`/api/bodegas/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ciudad: 'Barranquilla' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Bodega actualizada exitosamente.');
    expect(res.body.bodega.ciudad).toBe('Barranquilla');
  });
});

// ─────────────────────────────────────────────
// DELETE /api/bodegas/:id
// ─────────────────────────────────────────────
describe('DELETE /api/bodegas/:id', () => {
  test('retorna 409 con bodega que tiene productos asociados (ID 1)', async () => {
    // La bodega 1 tiene filas de inventario referenciándola (ON DELETE RESTRICT),
    // por lo que el DELETE es rechazado por MySQL y el servicio lo traduce a 409.
    const res = await request(app)
      .delete('/api/bodegas/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'No se puede eliminar la bodega porque tiene productos o inventario asociado.'
    );
  });

  test('retorna 200 eliminando la bodega creada', async () => {
    const res = await request(app)
      .delete(`/api/bodegas/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Bodega eliminada exitosamente.');
  });
});
