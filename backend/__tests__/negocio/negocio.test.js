const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

let token;
let negocioOriginal; // Fila singleton previa al PUT, para restaurarla en afterAll.

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

  // "negocio" es un registro singleton (id_negocio = 1) usado por el resto de la app;
  // se guarda su estado actual para restaurarlo después del PUT y no dejar datos de prueba.
  const [rows] = await pool.query('SELECT * FROM negocio LIMIT 1');
  negocioOriginal = rows[0];
});

afterAll(async () => {
  if (negocioOriginal) {
    await pool.query(
      `UPDATE negocio
       SET nombre = ?, nit = ?, direccion = ?, telefono = ?, correo = ?, logo_url = ?
       WHERE id_negocio = 1`,
      [
        negocioOriginal.nombre,
        negocioOriginal.nit,
        negocioOriginal.direccion,
        negocioOriginal.telefono,
        negocioOriginal.correo,
        negocioOriginal.logo_url,
      ]
    );
  }
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/negocio
// ─────────────────────────────────────────────
describe('GET /api/negocio', () => {
  test('retorna 200 con datos del negocio', async () => {
    const res = await request(app)
      .get('/api/negocio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_negocio');
    expect(res.body).toHaveProperty('nombre');
    expect(res.body).toHaveProperty('nit');
  });
});

// ─────────────────────────────────────────────
// PUT /api/negocio
// ─────────────────────────────────────────────
describe('PUT /api/negocio', () => {
  test('retorna 200 actualizando nombre y nit', async () => {
    const res = await request(app)
      .put('/api/negocio')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre:    'Empresa Jest Actualizada',
        nit:       '900999999-9',
        direccion: negocioOriginal.direccion,
        telefono:  negocioOriginal.telefono,
        correo:    negocioOriginal.correo,
        logo_url:  negocioOriginal.logo_url,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Negocio actualizado correctamente.');

    const getRes = await request(app)
      .get('/api/negocio')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.nombre).toBe('Empresa Jest Actualizada');
    expect(getRes.body.nit).toBe('900999999-9');
  });

  test('retorna 400 sin nombre o nit', async () => {
    const res = await request(app)
      .put('/api/negocio')
      .set('Authorization', `Bearer ${token}`)
      .send({ direccion: 'Calle Nueva 45' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Faltan campos requeridos: nombre, nit.');
  });
});
