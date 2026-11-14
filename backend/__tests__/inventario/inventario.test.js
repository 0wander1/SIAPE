const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

let token;
let productoId; // Producto propio creado en beforeAll con POST /api/productos.
let bodegaId;   // Primera bodega: donde POST /api/productos crea el inventario inicial del producto.
let bodegaId2;  // Segunda bodega, distinta de bodegaId.
let idCreado;   // PK del registro de inventario creado en el test POST.

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

  // Se necesitan dos bodegas distintas: POST /api/productos crea el inventario inicial
  // del producto en bodegaId, así que bodegaId2 queda libre para otra combinación.
  const [bodegas] = await pool.query('SELECT id_bodega FROM bodega LIMIT 2');
  if (bodegas.length < 2) {
    throw new Error(
      `inventario.test.js necesita al menos 2 bodegas en la base de datos; se encontraron ${bodegas.length}.`
    );
  }
  bodegaId  = bodegas[0].id_bodega;
  bodegaId2 = bodegas[1].id_bodega;

  // Se crea un producto propio en lugar de reutilizar uno existente, para que los
  // tests no dependan de datos reales ni borren productos que ya estaban en la BD.
  const productoRes = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nombre_producto:  `JEST-INV-${Date.now()}`,
      valor_neto:       1,
      valor_de_venta:   2,
      bodega_id_bodega: bodegaId,
      cantidad:         0,
      cantidad_minima:  0,
    });

  if (productoRes.status !== 201) {
    throw new Error(
      `No se pudo crear el producto de prueba con POST /api/productos: respuesta ${productoRes.status}.`
    );
  }
  productoId = productoRes.body.producto.id_producto;
});

afterAll(async () => {
  // Limpieza del producto de prueba y de todos sus registros de inventario, por si
  // algún test falló antes del DELETE. Se borra primero inventario por la FK hacia
  // producto. Si el DELETE ya los eliminó, ambas consultas no afectan ninguna fila.
  if (productoId) {
    try {
      await pool.query('DELETE FROM inventario WHERE producto_id_producto = ?', [productoId]);
      await pool.query('DELETE FROM producto WHERE id_producto = ?', [productoId]);
    } catch (error) {
      console.error('No se pudo limpiar el producto de prueba de inventario.test.js:', error);
    }
  }

  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/inventario
// ─────────────────────────────────────────────
describe('GET /api/inventario', () => {
  test('retorna 200 con array de registros de inventario', async () => {
    const res = await request(app)
      .get('/api/inventario')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Verifica la estructura del primer elemento cuando el listado no está vacío.
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id_inventario');
      expect(res.body[0]).toHaveProperty('nombre_producto');
      expect(res.body[0]).toHaveProperty('descripcion_bodega');
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/inventario/:id
// ─────────────────────────────────────────────
describe('GET /api/inventario/:id', () => {
  test('retorna 200 con ID existente (ID 62)', async () => {
    const res = await request(app)
      .get('/api/inventario/62')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_inventario', 62);
    expect(res.body).toHaveProperty('cantidad_disponible');
    expect(res.body).toHaveProperty('cantidad_reservada');
    expect(res.body).toHaveProperty('cantidad_minima');
    expect(res.body).toHaveProperty('producto_id_producto');
    expect(res.body).toHaveProperty('bodega_id_bodega');
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/inventario/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Registro de inventario no encontrado.');
  });
});

// ─────────────────────────────────────────────
// POST /api/inventario
// ─────────────────────────────────────────────
describe('POST /api/inventario', () => {
  test('retorna 201 creando registro con combinación producto-bodega sin duplicar', async () => {
    const res = await request(app)
      .post('/api/inventario')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cantidad_disponible:  20,
        cantidad_reservada:   0,
        cantidad_minima:      5,
        producto_id_producto: productoId,
        bodega_id_bodega:     bodegaId2,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Registro de inventario creado exitosamente.');
    expect(res.body.inventario).toHaveProperty('id_inventario');
    expect(res.body.inventario.producto_id_producto).toBe(productoId);
    expect(res.body.inventario.bodega_id_bodega).toBe(bodegaId2);
    expect(Number(res.body.inventario.cantidad_disponible)).toBe(20);

    idCreado = res.body.inventario.id_inventario;
  });

  test('retorna 400 con cantidad_disponible negativa', async () => {
    // El controlador rechaza la petición antes de llegar al servicio,
    // por lo que no se inserta ningún registro en la BD.
    const res = await request(app)
      .post('/api/inventario')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cantidad_disponible:  -10,
        producto_id_producto: 99999999,
        bodega_id_bodega:     99999999,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Las cantidades deben ser números mayores o iguales a cero.');
    expect(res.body).not.toHaveProperty('inventario');
  });
});

// ─────────────────────────────────────────────
// PUT /api/inventario/:id
// ─────────────────────────────────────────────
describe('PUT /api/inventario/:id', () => {
  test('retorna 200 actualizando el registro creado', async () => {
    const res = await request(app)
      .put(`/api/inventario/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        cantidad_disponible: 35,
        cantidad_minima:     8,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Inventario actualizado exitosamente.');
    expect(Number(res.body.inventario.cantidad_disponible)).toBe(35);
    expect(Number(res.body.inventario.cantidad_minima)).toBe(8);
    // ultima_actualizacion debe haberse actualizado; basta con comprobar que existe.
    expect(res.body.inventario).toHaveProperty('ultima_actualizacion');
  });

  test('retorna 400 con cantidad_disponible negativa', async () => {
    // El controlador rechaza la petición antes de llegar al servicio,
    // por lo que no se consulta ni modifica ningún registro en la BD.
    const res = await request(app)
      .put('/api/inventario/99999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ cantidad_disponible: -10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Las cantidades deben ser números mayores o iguales a cero.');
  });
});

// ─────────────────────────────────────────────
// DELETE /api/inventario/:id
// ─────────────────────────────────────────────
describe('DELETE /api/inventario/:id', () => {
  test('retorna 409 con producto que tiene facturas asociadas (ID 62, producto 32)', async () => {
    // El controlador requiere producto_id_producto en el body para ejecutar
    // removeConProducto, que intenta borrar primero el producto. Como el producto 32
    // tiene facturas asociadas, MySQL lanza ER_ROW_IS_REFERENCED_2 → 409.
    const res = await request(app)
      .delete('/api/inventario/62')
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id_producto: 32 });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'No se puede eliminar el producto porque tiene registros asociados.'
    );
  });

  test('retorna 200 eliminando el registro creado', async () => {
    // removeConProducto elimina producto e inventario en la misma transacción.
    // El productoId hallado en beforeAll no tiene pedido_externo ni otras FKs activas,
    // por lo que el DELETE debe completarse sin restricción referencial.
    const res = await request(app)
      .delete(`/api/inventario/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id_producto: productoId });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Producto e inventario eliminados exitosamente.');
  });
});
