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
// PUT /api/proveedores/:id
// ─────────────────────────────────────────────
describe('PUT /api/proveedores/:id', () => {
  test('retorna 409 al actualizar con un NIT que ya pertenece a otro proveedor', async () => {
    // Se crea un segundo proveedor propio (no idCreado) solo para poseer un NIT
    // distinto ya registrado, y así forzar el conflicto al intentar asignárselo
    // a idCreado mediante PUT.
    const OTRO_NIT = `NIT_JEST_OTRO_${Date.now()}`;

    const otroRes = await request(app)
      .post('/api/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_proveedor: 'Proveedor Jest Otro',
        NIT:              OTRO_NIT,
        id_usuario_trab:  adminId,
      });

    expect(otroRes.status).toBe(201);
    const otroId = otroRes.body.proveedor.id_proveedor;

    const res = await request(app)
      .put(`/api/proveedores/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ NIT: OTRO_NIT });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Ya existe un proveedor con ese NIT.');

    // Limpieza: se elimina el proveedor auxiliar creado solo para esta prueba.
    await pool.query('DELETE FROM proveedor WHERE id_proveedor = ?', [otroId]);
  });

  test('retorna 200 conservando la relación existente sin duplicarla ni cambiar su precio', async () => {
    // Proveedor propio creado directamente en la BD, con nombre y NIT únicos.
    const sufijo = Date.now();
    const [provResult] = await pool.query(
      'INSERT INTO proveedor (nombre_proveedor, NIT, id_usuario_trab) VALUES (?, ?, ?)',
      [`Proveedor Jest Relacion ${sufijo}`, `NIT_JEST_REL_${sufijo}`, adminId]
    );
    const proveedorId = provResult.insertId;

    try {
      // Relación previa con un precio de compra distinto del valor por defecto (0).
      await pool.query(
        `INSERT INTO producto_has_proveedor
           (producto_id_producto, proveedor_id_proveedor, precio_compra, es_proveedor_principal, activo)
         VALUES (?, ?, 4500, 0, 1)`,
        [productoId, proveedorId]
      );

      // Se edita el proveedor enviando el mismo producto; el servicio debe conservar
      // la relación existente en lugar de borrarla y volver a crearla.
      const res = await request(app)
        .put(`/api/proveedores/${proveedorId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          productos_asociados: [
            { producto_id_producto: productoId, esPrincipal: false },
          ],
        });

      expect(res.status).toBe(200);

      const [relaciones] = await pool.query(
        'SELECT precio_compra FROM producto_has_proveedor WHERE proveedor_id_proveedor = ? AND producto_id_producto = ?',
        [proveedorId, productoId]
      );
      expect(relaciones).toHaveLength(1);
      expect(Number(relaciones[0].precio_compra)).toBe(4500);
    } finally {
      // Se borran primero las relaciones por la FK hacia proveedor.
      await pool.query('DELETE FROM producto_has_proveedor WHERE proveedor_id_proveedor = ?', [proveedorId]);
      await pool.query('DELETE FROM proveedor WHERE id_proveedor = ?', [proveedorId]);
    }
  });

  test('retorna 200 marcando como principal una relación existente sin cambiar su precio', async () => {
    // Proveedor propio creado directamente en la BD, con nombre y NIT únicos.
    const sufijo = Date.now();
    const [provResult] = await pool.query(
      'INSERT INTO proveedor (nombre_proveedor, NIT, id_usuario_trab) VALUES (?, ?, ?)',
      [`Proveedor Jest Principal ${sufijo}`, `NIT_JEST_PRIN_${sufijo}`, adminId]
    );
    const proveedorId = provResult.insertId;

    try {
      // Relación previa que no es principal y tiene un precio distinto del valor por defecto.
      await pool.query(
        `INSERT INTO producto_has_proveedor
           (producto_id_producto, proveedor_id_proveedor, precio_compra, es_proveedor_principal, activo)
         VALUES (?, ?, 4500, 0, 1)`,
        [productoId, proveedorId]
      );

      // Se edita enviando el mismo producto con esPrincipal: true; el servicio debe
      // actualizar solo la marca de principal en la relación existente.
      const res = await request(app)
        .put(`/api/proveedores/${proveedorId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          productos_asociados: [
            { producto_id_producto: productoId, esPrincipal: true },
          ],
        });

      expect(res.status).toBe(200);

      const [relaciones] = await pool.query(
        `SELECT precio_compra, es_proveedor_principal FROM producto_has_proveedor
         WHERE proveedor_id_proveedor = ? AND producto_id_producto = ?`,
        [proveedorId, productoId]
      );
      expect(relaciones).toHaveLength(1);
      expect(Number(relaciones[0].es_proveedor_principal)).toBe(1);
      expect(Number(relaciones[0].precio_compra)).toBe(4500);
    } finally {
      // Se borran primero las relaciones por la FK hacia proveedor.
      await pool.query('DELETE FROM producto_has_proveedor WHERE proveedor_id_proveedor = ?', [proveedorId]);
      await pool.query('DELETE FROM proveedor WHERE id_proveedor = ?', [proveedorId]);
    }
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
