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

// pqrs.service envía con Resend por su cuenta (no pasa por email.service), por lo que se
// mockea aparte para que el controlador no haga una llamada real a la API de Resend.
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

  test('retorna 502 si el servicio de correo falla', async () => {
    const emailError = new Error('Fallo simulado de Resend');
    pqrsService.send.mockRejectedValueOnce(emailError);
    // El controlador registra el error con console.error; se silencia para no ensuciar la salida.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await request(app)
        .post('/api/pqrs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo:        'queja',
          asunto:      'Asunto de prueba Jest',
          descripcion: 'Descripción de prueba para el caso de fallo del correo.',
        });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('No se pudo enviar el PQRS. Intenta de nuevo más tarde.');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error al enviar PQRS:', emailError);
    } finally {
      // Se restaura el mock aunque el test falle: se descarta el rechazo pendiente (si no se
      // consumió) y se vuelve a la implementación por defecto que resuelve sin error.
      pqrsService.send.mockReset();
      pqrsService.send.mockResolvedValue(undefined);
      consoleErrorSpy.mockRestore();
    }
  });

  test('retorna 400 con tipo inválido y no envía el correo', async () => {
    // Se limpian las llamadas registradas por tests anteriores para que
    // not.toHaveBeenCalled() refleje solo esta petición.
    pqrsService.send.mockClear();

    const res = await request(app)
      .post('/api/pqrs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo:        'felicitacion',
        asunto:      'Asunto de prueba Jest',
        descripcion: 'Descripción de prueba con un tipo no permitido.',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tipo inválido. Debe ser Petición, Queja, Reclamo o Sugerencia.');
    expect(pqrsService.send).not.toHaveBeenCalled();
  });

  test('acepta tipo con mayúscula y tilde y lo pasa al servicio sin modificar', async () => {
    // Se limpian las llamadas anteriores para verificar solo la de esta petición.
    pqrsService.send.mockClear();

    const res = await request(app)
      .post('/api/pqrs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo:        'Petición',
        asunto:      'Asunto de prueba Jest',
        descripcion: 'Descripción de prueba con tipo en mayúscula y con tilde.',
      });

    expect(res.status).toBe(200);
    expect(pqrsService.send).toHaveBeenCalledTimes(1);
    expect(pqrsService.send).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Petición' })
    );
  });

  test('retorna 401 sin cabecera Authorization', async () => {
    // Se limpian las llamadas anteriores para verificar que esta petición no llega al servicio.
    pqrsService.send.mockClear();

    const res = await request(app)
      .post('/api/pqrs')
      .send({
        tipo:        'queja',
        asunto:      'Asunto de prueba Jest',
        descripcion: 'Descripción de prueba sin token.',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token no proporcionado.');
    expect(pqrsService.send).not.toHaveBeenCalled();
  });

  test('usa como remitente el user_name del token e ignora el remitente del body', async () => {
    // Se limpian las llamadas anteriores para verificar solo la de esta petición.
    pqrsService.send.mockClear();

    const res = await request(app)
      .post('/api/pqrs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo:        'queja',
        asunto:      'Asunto de prueba Jest',
        descripcion: 'Descripción de prueba con remitente falso en el body.',
        remitente:   'usuario_suplantado',
      });

    expect(res.status).toBe(200);
    expect(pqrsService.send).toHaveBeenCalledTimes(1);
    expect(pqrsService.send).toHaveBeenCalledWith(
      expect.objectContaining({ remitente: 'adminhector' })
    );
  });
});
