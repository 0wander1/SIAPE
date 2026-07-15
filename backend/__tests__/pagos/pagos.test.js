const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

let token;
let adminId;
let facturaId;    // Factura con saldo pendiente > 0, obtenida dinámicamente de la BD.
let montoPagado;  // Monto válido (≤ saldo pendiente de facturaId) para el POST 201.
let idCreado;     // PK del pago creado en POST, reutilizado en DELETE.

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

  // Factura en estado 'emitida' o 'parcial' con saldo pendiente > 0: el servicio de
  // pagos rechaza con 422 cualquier monto que supere (total - pagos previos).
  const [facRows] = await pool.query(`
    SELECT f.id_factura, (f.total - COALESCE(SUM(p.monto_pagado), 0)) AS saldo_pendiente
    FROM factura f
    LEFT JOIN pago p ON p.factura_id_factura = f.id_factura
    WHERE f.estado IN ('emitida', 'parcial')
    GROUP BY f.id_factura, f.total
    HAVING saldo_pendiente > 0
    LIMIT 1
  `);

  facturaId = facRows[0]?.id_factura;
  // La mitad del saldo pendiente, redondeada a 2 decimales, garantiza un monto
  // válido y positivo sin agotar el saldo ni exceder la precisión DECIMAL(15,2).
  montoPagado = Number((facRows[0]?.saldo_pendiente / 2).toFixed(2));
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/pagos
// ─────────────────────────────────────────────
describe('GET /api/pagos', () => {
  test('retorna 200 con array de pagos', async () => {
    const res = await request(app)
      .get('/api/pagos')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/pagos/:id
// ─────────────────────────────────────────────
describe('GET /api/pagos/:id', () => {
  test('retorna 200 con ID existente (ID 8)', async () => {
    const res = await request(app)
      .get('/api/pagos/8')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_pago', 8);
    expect(res.body).toHaveProperty('monto_pagado');
    expect(res.body).toHaveProperty('fecha_pago');
    expect(res.body).toHaveProperty('metodo_pago');
    expect(res.body).toHaveProperty('factura_id_factura');
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/pagos/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Pago no encontrado.');
  });
});

// ─────────────────────────────────────────────
// POST /api/pagos
// ─────────────────────────────────────────────
describe('POST /api/pagos', () => {
  test('retorna 201 con datos válidos sobre una factura emitida o parcial', async () => {
    const res = await request(app)
      .post('/api/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        monto_pagado:                  montoPagado,
        fecha_pago:                    new Date().toISOString().split('T')[0],
        metodo_pago:                   'transferencia',
        referencia_transaccion:        `JEST-${Date.now()}`,
        factura_id_factura:            facturaId,
        usuario_trab_id_usuario_trab:  adminId,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Pago registrado exitosamente.');
    expect(res.body.pago).toHaveProperty('id_pago');
    expect(res.body.pago.factura_id_factura).toBe(facturaId);
    expect(Number(res.body.pago.monto_pagado)).toBe(montoPagado);

    idCreado = res.body.pago.id_pago;
  });

  test('retorna 400 con monto en cero', async () => {
    const res = await request(app)
      .post('/api/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        monto_pagado:                  0,
        fecha_pago:                    new Date().toISOString().split('T')[0],
        metodo_pago:                   'efectivo',
        factura_id_factura:            facturaId,
        usuario_trab_id_usuario_trab:  adminId,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Faltan campos requeridos: monto_pagado, fecha_pago, metodo_pago, factura_id_factura, usuario_trab_id_usuario_trab.'
    );
  });
});

// ─────────────────────────────────────────────
// DELETE /api/pagos/:id
// ─────────────────────────────────────────────
describe('DELETE /api/pagos/:id', () => {
  test('retorna 200 eliminando el pago creado', async () => {
    const res = await request(app)
      .delete(`/api/pagos/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Pago eliminado exitosamente.');
  });
});
