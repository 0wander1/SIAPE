const request = require('supertest');
const app     = require('../../server');
const { pool } = require('../../src/config/db');

// Evita que los tests intenten enviar correos reales.
// El controller despacha el email en fire-and-forget después de responder,
// pero el transport de nodemailer dejaría handles abiertos si no se mockea.
jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  test('login exitoso retorna 200 con userId', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        user_name: 'adminhector',
        password: process.env.TEST_ADMIN_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body.message).toBe('Código enviado a tu correo.');
  });

  test('credenciales incorrectas retorna 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        user_name: 'adminhector',
        password: 'contraseña_incorrecta_xyz',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales incorrectas.');
  });

  test('campos vacíos retorna 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('user_name y password son requeridos.');
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/verify-code
// ─────────────────────────────────────────────
describe('POST /api/auth/verify-code', () => {
  test('código incorrecto retorna 401', async () => {
    // Primero hace login para que el servicio guarde un código real en codigosTemporales.
    // Sin este paso no habría entrada en el Map y verify-code devolvería 401 por "no entry",
    // lo que también es correcto pero no cubre el branch de código-no-coincide.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        user_name: 'adminhector',
        password: process.env.TEST_ADMIN_PASSWORD,
      });

    expect(loginRes.status).toBe(200);
    const { userId } = loginRes.body;

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({
        userId,
        codigo: '000000',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Código incorrecto o expirado.');
  });
});
