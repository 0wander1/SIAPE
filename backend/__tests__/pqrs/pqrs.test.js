const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const pqrsService = require('../../src/services/pqrs.service');
const jwt         = require('jsonwebtoken');

// email.service se usa en el flujo de login (código de verificación).
jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// pqrs.service usa nodemailer directamente (no pasa por email.service), por lo que se
// mockea aparte para que el controlador no intente una conexión SMTP real en fire-and-forget.
jest.mock('../../src/services/pqrs.service', () => ({
  send: jest.fn().mockResolvedValue(undefined),
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
// POST /api/pqrs
// ─────────────────────────────────────────────
describe('POST /api/pqrs', () => {
  test('retorna 200 con datos válidos (tipo, asunto, descripcion)', async () => {
    const res = await request(app)
      .post('/api/pqrs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo:        'queja',
        asunto:      'Asunto de prueba Jest',
        descripcion: 'Descripción de prueba enviada desde el test de integración.',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('PQRS enviado correctamente.');
    expect(pqrsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo:        'queja',
        asunto:      'Asunto de prueba Jest',
        descripcion: 'Descripción de prueba enviada desde el test de integración.',
      })
    );
  });

  test('retorna 400 con campos vacíos', async () => {
    const res = await request(app)
      .post('/api/pqrs')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: '', asunto: '', descripcion: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Faltan campos requeridos: tipo, asunto, descripcion.');
  });
});
