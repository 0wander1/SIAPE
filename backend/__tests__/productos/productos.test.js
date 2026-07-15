const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

let token;
let bodegaId; // Obtenido dinámicamente de la BD en beforeAll.
let idCreado; // Guardado en POST 201, reutilizado en PUT y DELETE 200.

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

  // Primera bodega disponible en la BD para asociarla al producto de prueba.
  // Si la tabla bodega estuviera vacía el POST fallaría con FK error, lo que
  // indica un problema de datos del entorno, no un bug del código bajo prueba.
  const [rows] = await pool.query('SELECT id_bodega FROM bodega LIMIT 1');
  bodegaId = rows[0]?.id_bodega;
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/productos
// ─────────────────────────────────────────────
describe('GET /api/productos', () => {
  test('retorna 200 con array de productos', async () => {
    const res = await request(app)
      .get('/api/productos')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/productos/:id
// ─────────────────────────────────────────────
describe('GET /api/productos/:id', () => {
  test('retorna 200 con ID existente (ID 27)', async () => {
    const res = await request(app)
      .get('/api/productos/27')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_producto', 27);
    expect(res.body).toHaveProperty('nombre_producto');
    expect(res.body).toHaveProperty('valor_neto');
    expect(res.body).toHaveProperty('valor_de_venta');
    expect(res.body).toHaveProperty('bodega_id_bodega');
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/productos/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Producto no encontrado.');
  });
});

// ─────────────────────────────────────────────
// GET /api/productos/:id/proveedores
// ─────────────────────────────────────────────
describe('GET /api/productos/:id/proveedores', () => {
  test('retorna 200 con array de proveedores del producto (ID 27)', async () => {
    const res = await request(app)
      .get('/api/productos/27/proveedores')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Si tiene proveedores asociados, cada elemento debe tener la estructura esperada.
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id_proveedor');
      expect(res.body[0]).toHaveProperty('nombre_proveedor');
      expect(res.body[0]).toHaveProperty('precio_compra');
      expect(res.body[0]).toHaveProperty('es_proveedor_principal');
    }
  });
});

// ─────────────────────────────────────────────
// POST /api/productos
// ─────────────────────────────────────────────
describe('POST /api/productos', () => {
  test('retorna 201 con datos válidos', async () => {
    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_producto:  'Producto Jest Test',
        valor_neto:       8000,
        valor_de_venta:   12000,
        bodega_id_bodega: bodegaId,
        cantidad:         10,
        cantidad_minima:  2,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Producto creado exitosamente.');
    expect(res.body.producto).toHaveProperty('id_producto');
    expect(res.body.producto.nombre_producto).toBe('Producto Jest Test');
    expect(res.body.producto.bodega_id_bodega).toBe(bodegaId);

    idCreado = res.body.producto.id_producto;
  });
});

// ─────────────────────────────────────────────
// PUT /api/productos/:id
// ─────────────────────────────────────────────
describe('PUT /api/productos/:id', () => {
  test('retorna 200 actualizando el producto creado', async () => {
    const res = await request(app)
      .put(`/api/productos/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre_producto:  'Producto Jest Test Actualizado',
        valor_neto:       9000,
        valor_de_venta:   13500,
        bodega_id_bodega: bodegaId,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Producto actualizado exitosamente.');
    expect(res.body.producto.nombre_producto).toBe('Producto Jest Test Actualizado');
    expect(Number(res.body.producto.valor_neto)).toBe(9000);
    expect(Number(res.body.producto.valor_de_venta)).toBe(13500);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/productos/:id
// ─────────────────────────────────────────────
describe('DELETE /api/productos/:id', () => {
  test('retorna 409 con producto que tiene facturas asociadas (ID 27)', async () => {
    const res = await request(app)
      .delete('/api/productos/27')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    // El servicio puede llegar al 409 por dos rutas:
    //   1. SELECT en pedido_externo → 'tiene pedidos asociados'
    //   2. ER_ROW_IS_REFERENCED_2 de FK de facturas → 'tiene facturas o pedidos asociados.'
    // Se usa toMatch para cubrir ambas variantes según el estado real de ID 27.
    expect(res.body.message).toMatch(/No se puede eliminar el producto/);
  });

  test('retorna 200 eliminando el producto creado', async () => {
    const res = await request(app)
      .delete(`/api/productos/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Producto eliminado exitosamente.');
  });
});
