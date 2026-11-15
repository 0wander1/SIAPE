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

  // Primer proveedor disponible, ahora obligatorio al crear un producto.
  const [proveedores] = await pool.query('SELECT id_proveedor FROM proveedor LIMIT 1');
  const proveedorId = proveedores[0]?.id_proveedor;

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
      proveedor_id_proveedor: proveedorId,
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

  test('retorna 409 si el producto tiene inventario en otras bodegas', async () => {
    // El producto de prueba tiene inventario en bodegaId (creado por POST /api/productos)
    // y en bodegaId2 (idCreado). Borrar el producto eliminaría en cascada el de bodegaId,
    // así que removeConProducto rechaza el DELETE.
    const res = await request(app)
      .delete(`/api/inventario/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id_producto: productoId });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('No se puede eliminar el producto porque tiene inventario en otras bodegas.');
  });

  test('retorna 200 eliminando el último registro de inventario del producto', async () => {
    // Se borran los demás registros del producto para que idCreado sea el único;
    // así removeConProducto puede eliminar producto e inventario en la misma transacción.
    await pool.query(
      'DELETE FROM inventario WHERE producto_id_producto = ? AND id_inventario <> ?',
      [productoId, idCreado]
    );

    const res = await request(app)
      .delete(`/api/inventario/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id_producto: productoId });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Producto e inventario eliminados exitosamente.');
  });

  test('retorna 404 con registro de inventario inexistente', async () => {
    // El servicio no encuentra el registro, hace rollback y no borra nada.
    const res = await request(app)
      .delete('/api/inventario/999999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id_producto: 1 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Registro de inventario no encontrado.');
  });

  test('retorna 400 si el producto no corresponde al registro', async () => {
    // El registro 62 existe pero pertenece a otro producto; el servicio lanza el
    // error antes de cualquier DELETE y hace rollback, sin modificar la BD.
    const res = await request(app)
      .delete('/api/inventario/62')
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id_producto: 999999999 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El producto no corresponde al registro de inventario.');
  });
});

// ─────────────────────────────────────────────
// POST /api/inventario/carga-masiva
// ─────────────────────────────────────────────
describe('POST /api/inventario/carga-masiva', () => {
  test('no crea nada si la fila de un producto nuevo no trae proveedor_id_proveedor', async () => {
    // El nombre único garantiza que el producto no exista, así que el servicio
    // entra en la rama de creación y debe rechazar la fila antes de cualquier INSERT.
    const nombre = `JEST-CARGA-SINPROV-${Date.now()}`;

    const res = await request(app)
      .post('/api/inventario/carga-masiva')
      .set('Authorization', `Bearer ${token}`)
      .send([
        {
          nombre_producto:     nombre,
          bodega_id_bodega:    bodegaId,
          cantidad_disponible: 5,
        },
      ]);

    expect(res.status).toBe(200);
    expect(res.body.creados).toBe(0);
    expect(res.body.actualizados).toBe(0);
    expect(res.body.errores).toContain(
      'Fila 2: proveedor_id_proveedor es requerido para crear un producto nuevo.'
    );

    const [productos] = await pool.query(
      'SELECT id_producto FROM producto WHERE nombre_producto = ?',
      [nombre]
    );
    expect(productos).toHaveLength(0);
  });

  test('no crea nada si el proveedor de un producto nuevo no existe', async () => {
    // El servicio comprueba el proveedor antes del INSERT del producto, hace
    // rollback de la fila y la registra en errores.
    const nombre = `JEST-CARGA-PROVINEX-${Date.now()}`;

    const res = await request(app)
      .post('/api/inventario/carga-masiva')
      .set('Authorization', `Bearer ${token}`)
      .send([
        {
          nombre_producto:        nombre,
          bodega_id_bodega:       bodegaId,
          cantidad_disponible:    5,
          proveedor_id_proveedor: 999999999,
        },
      ]);

    expect(res.status).toBe(200);
    expect(res.body.creados).toBe(0);
    expect(res.body.actualizados).toBe(0);
    expect(res.body.errores).toContain('Fila 2: el proveedor con ID 999999999 no existe.');

    const [productos] = await pool.query(
      'SELECT id_producto FROM producto WHERE nombre_producto = ?',
      [nombre]
    );
    expect(productos).toHaveLength(0);
  });

  test('retorna 200 creando producto, inventario y relación con el proveedor', async () => {
    const nombre = `JEST-CARGA-OK-${Date.now()}`;

    // Proveedor existente leído de la BD, sin ids fijos. bodegaId también se obtuvo
    // con pool.query en el beforeAll.
    const [[proveedor]] = await pool.query('SELECT id_proveedor FROM proveedor LIMIT 1');
    if (!proveedor) {
      throw new Error('inventario.test.js necesita al menos 1 proveedor en la base de datos.');
    }
    const proveedorId = proveedor.id_proveedor;

    let idProducto;
    try {
      const res = await request(app)
        .post('/api/inventario/carga-masiva')
        .set('Authorization', `Bearer ${token}`)
        .send([
          {
            nombre_producto:        nombre,
            bodega_id_bodega:       bodegaId,
            cantidad_disponible:    7,
            proveedor_id_proveedor: proveedorId,
          },
        ]);

      expect(res.status).toBe(200);
      expect(res.body.creados).toBe(1);
      expect(res.body.errores).toEqual([]);

      const [[producto]] = await pool.query(
        'SELECT id_producto FROM producto WHERE nombre_producto = ?',
        [nombre]
      );
      expect(producto).toBeDefined();
      idProducto = producto.id_producto;

      const [inventario] = await pool.query(
        'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ? AND bodega_id_bodega = ?',
        [idProducto, bodegaId]
      );
      expect(inventario).toHaveLength(1);
      expect(Number(inventario[0].cantidad_disponible)).toBe(7);

      const [relacion] = await pool.query(
        'SELECT 1 FROM producto_has_proveedor WHERE producto_id_producto = ? AND proveedor_id_proveedor = ?',
        [idProducto, proveedorId]
      );
      expect(relacion).toHaveLength(1);
    } finally {
      // Se borra por nombre para limpiar aunque el test haya fallado antes de leer el id.
      // Las FK de inventario y producto_has_proveedor hacia producto son ON DELETE CASCADE.
      await pool.query('DELETE FROM producto WHERE nombre_producto = ?', [nombre]);
    }

    // Comprueba que la limpieza no dejó nada.
    const [productosRestantes] = await pool.query(
      'SELECT id_producto FROM producto WHERE nombre_producto = ?',
      [nombre]
    );
    expect(productosRestantes).toHaveLength(0);

    const [inventarioRestante] = await pool.query(
      'SELECT id_inventario FROM inventario WHERE producto_id_producto = ?',
      [idProducto]
    );
    expect(inventarioRestante).toHaveLength(0);

    const [relacionRestante] = await pool.query(
      'SELECT 1 FROM producto_has_proveedor WHERE producto_id_producto = ?',
      [idProducto]
    );
    expect(relacionRestante).toHaveLength(0);
  });
});
