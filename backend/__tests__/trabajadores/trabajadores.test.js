const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

// El login requiere envío de correo — se mockea para no abrir handles reales.
jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// Nombre único por ejecución para evitar colisiones entre corridas de test.
const TEST_USERNAME = `jest_trab_${Date.now()}`;

let token;
let idCreado; // Guardado en el test POST 201 y reutilizado en DELETE.

beforeAll(async () => {
  // Fijamos el OTP en un valor conocido para poder completar el verify-code
  // sin acceder al Map interno de authService ni interceptar el correo.
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

  // Restaurar generateCode antes de que los tests de auth corran en paralelo.
  jest.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/trabajadores
// ─────────────────────────────────────────────
describe('GET /api/trabajadores', () => {
  test('retorna 200 con array de trabajadores', async () => {
    const res = await request(app)
      .get('/api/trabajadores')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/trabajadores/:id
// ─────────────────────────────────────────────
describe('GET /api/trabajadores/:id', () => {
  test('retorna 200 con ID existente', async () => {
    // Se decodifica el token para obtener el ID del propio admin,
    // garantizando que el registro existe sin consultas adicionales.
    const { id } = jwt.verify(token, process.env.JWT_SECRET);

    const res = await request(app)
      .get(`/api/trabajadores/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_usuario_trab');
    expect(res.body).toHaveProperty('user_name');
    // COLUMNAS_PUBLICAS nunca incluye password_hash ni salt.
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('salt');
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/trabajadores/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Trabajador no encontrado.');
  });
});

// ─────────────────────────────────────────────
// POST /api/trabajadores
// ─────────────────────────────────────────────
describe('POST /api/trabajadores', () => {
  test('retorna 201 con datos válidos', async () => {
    const res = await request(app)
      .post('/api/trabajadores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cargo:     'vendedor',
        user_name: TEST_USERNAME,
        password:  'TestPass123!',
        direccion: 'Calle Test 1',
        turno:     'Mañana',
        celular:   '3001234567',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Trabajador creado exitosamente.');
    expect(res.body.trabajador).toHaveProperty('id_usuario_trab');
    expect(res.body.trabajador.user_name).toBe(TEST_USERNAME);
    expect(res.body.trabajador).not.toHaveProperty('password_hash');

    // Se guarda el ID para los tests de DELETE.
    idCreado = res.body.trabajador.id_usuario_trab;
  });

  test('retorna 409 con username duplicado', async () => {
    const res = await request(app)
      .post('/api/trabajadores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cargo:     'vendedor',
        user_name: TEST_USERNAME, // mismo username del test anterior
        password:  'OtraPass456!',
        direccion: 'Calle Test 2',
        turno:     'Tarde',
        celular:   '3009876543',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('El nombre de usuario ya está en uso.');
  });
});

// ─────────────────────────────────────────────
// DELETE /api/trabajadores/:id
// ─────────────────────────────────────────────
describe('DELETE /api/trabajadores/:id', () => {
  test('retorna 200 con ID existente', async () => {
    const res = await request(app)
      .delete(`/api/trabajadores/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Trabajador eliminado exitosamente.');
  });
});
