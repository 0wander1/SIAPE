const request     = require('supertest');
const app         = require('../../server');
const { pool }    = require('../../src/config/db');
const authService = require('../../src/services/auth.service');
const jwt         = require('jsonwebtoken');

jest.mock('../../src/services/email.service', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

// numero_factura debe ser único (índice UNIQUE en BD).
const NUMERO_FACTURA = `JEST-${Date.now()}`;

let token;
let adminId;
let clienteId;  // Obtenido dinámicamente de la BD.
let productoId; // Producto con stock ≥ 1 en inventario para el descuento de la venta directa.
let idCreado;   // PK de la factura creada en POST, reutilizado en PUT y DELETE.

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

  // Primer cliente disponible como FK opcional de la factura.
  const [cliRows] = await pool.query(
    'SELECT id_usuario_cli FROM cliente LIMIT 1'
  );
  clienteId = cliRows[0]?.id_usuario_cli;

  // Producto con al menos 1 unidad disponible en inventario.
  // El servicio valida stock con FOR UPDATE antes de descontar; sin stock lanza 400.
  const [prodRows] = await pool.query(`
    SELECT p.id_producto
    FROM producto p
    JOIN inventario i ON i.producto_id_producto = p.id_producto
    WHERE i.cantidad_disponible >= 1
    LIMIT 1
  `);
  productoId = prodRows[0]?.id_producto;
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// GET /api/facturas
// ─────────────────────────────────────────────
describe('GET /api/facturas', () => {
  test('retorna 200 con array de facturas', async () => {
    const res = await request(app)
      .get('/api/facturas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/facturas/:id
// ─────────────────────────────────────────────
describe('GET /api/facturas/:id', () => {
  test('retorna 200 con ID existente (ID 16) incluyendo items', async () => {
    const res = await request(app)
      .get('/api/facturas/16')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_factura', 16);
    expect(res.body).toHaveProperty('numero_factura');
    expect(res.body).toHaveProperty('subtotal');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('estado');
    // getById siempre adjunta items[], incluso si la factura no tiene ítems (array vacío).
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    if (res.body.items.length > 0) {
      expect(res.body.items[0]).toHaveProperty('producto_id_producto');
      expect(res.body.items[0]).toHaveProperty('cantidad');
      expect(res.body.items[0]).toHaveProperty('valor_unitario');
      expect(res.body.items[0]).toHaveProperty('nombre_producto');
    }
  });

  test('retorna 404 con ID inexistente', async () => {
    const res = await request(app)
      .get('/api/facturas/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Factura no encontrada.');
  });
});

// ─────────────────────────────────────────────
// POST /api/facturas
// ─────────────────────────────────────────────
describe('POST /api/facturas', () => {
  test('retorna 201 con datos válidos incluyendo cliente y productos', async () => {
    // Modo B (venta directa): sin pedido_id_pedido, con array productos.
    // El servicio bloquea la fila de inventario con FOR UPDATE, verifica stock
    // y descuenta las unidades antes de insertar la factura y sus ítems.
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     NUMERO_FACTURA,
        fecha_emision:      new Date().toISOString().split('T')[0],
        fecha_vencimiento:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal:           10000,
        impuesto:           1900,
        descuento:          0,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             1,
            valor_unitario:       10000,
          },
        ],
      });

    console.log('Response body:', JSON.stringify(res.body));
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Factura creada exitosamente.');
    expect(res.body.factura).toHaveProperty('id_factura');
    expect(res.body.factura.numero_factura).toBe(NUMERO_FACTURA);
    // total = subtotal + impuesto - descuento = 10000 + 1900 - 0 = 11900
    expect(Number(res.body.factura.total)).toBe(11900);
    expect(res.body.factura).toHaveProperty('items');
    expect(res.body.factura.items).toHaveLength(1);

    idCreado = res.body.factura.id_factura;
  });

  test('la cantidad disponible en inventario disminuye tras crear la factura', async () => {
    // Usa su propia factura (no idCreado) para no interferir con los describe de
    // PUT/DELETE, que reutilizan la factura del test anterior.
    const cantidadVendida = 1;

    const [beforeRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ?',
      [productoId]
    );
    // Number(): mysql2 devuelve las columnas DECIMAL como string (p. ej. "75.00").
    const stockAntes = Number(beforeRows[0].cantidad_disponible);

    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     `JEST-STOCKCHECK-${Date.now()}`,
        fecha_emision:      new Date().toISOString().split('T')[0],
        fecha_vencimiento:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal:           10000,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             cantidadVendida,
            valor_unitario:       10000,
          },
        ],
      });

    expect(res.status).toBe(201);

    const [afterRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ?',
      [productoId]
    );
    const stockDespues = Number(afterRows[0].cantidad_disponible);

    expect(stockDespues).toBe(stockAntes - cantidadVendida);

    // Limpieza: se elimina la factura creada (factura_item cae en cascada) y se
    // restaura el stock descontado, para que el test de "stock insuficiente"
    // (que consulta cantidad_disponible real) no se vea afectado por este test.
    await pool.query('DELETE FROM factura WHERE id_factura = ?', [
      res.body.factura.id_factura,
    ]);
    await pool.query(
      'UPDATE inventario SET cantidad_disponible = cantidad_disponible + ? WHERE producto_id_producto = ?',
      [cantidadVendida, productoId]
    );
  });

  test('retorna 400 sin productos en venta directa', async () => {
    // Sin pedido_id_pedido y con productos vacío: el servicio lanza error status 400
    // antes de abrir transacción. El controlador lo propaga al errorHandler → 400.
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:  `JEST-NOPROD-${Date.now()}`,
        fecha_emision:   new Date().toISOString().split('T')[0],
        subtotal:        5000,
        estado:          'pendiente',
        usuario_trab_id: adminId,
        productos:       [],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Para venta directa se requiere al menos un producto'
    );
  });

  test('retorna 409 con numero_factura duplicado', async () => {
    // Reutiliza NUMERO_FACTURA, ya insertado por el test anterior ("201 con datos
    // válidos"), para violar el índice UNIQUE de la tabla factura. MySQL lanza
    // ER_DUP_ENTRY, que el controlador mapea explícitamente a 409.
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     NUMERO_FACTURA,
        fecha_emision:      new Date().toISOString().split('T')[0],
        fecha_vencimiento:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal:           10000,
        impuesto:           1900,
        descuento:          0,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             1,
            valor_unitario:       10000,
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('message');
  });

  test('retorna 400 cuando la cantidad solicitada supera el stock disponible', async () => {
    // Se consulta el stock actual en lugar de asumir un valor fijo, ya que los
    // tests anteriores de este describe pudieron modificarlo. Se pide una unidad
    // más de la disponible para forzar la validación de stock insuficiente,
    // que el servicio verifica dentro de la transacción antes del UPDATE.
    const [invRows] = await pool.query(
      'SELECT cantidad_disponible FROM inventario WHERE producto_id_producto = ?',
      [productoId]
    );
    const stockDisponible = invRows[0].cantidad_disponible;

    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     `JEST-STOCK-${Date.now()}`,
        fecha_emision:      new Date().toISOString().split('T')[0],
        subtotal:           10000,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             stockDisponible + 1,
            valor_unitario:       10000,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      `Stock insuficiente para el producto ${productoId}`
    );
  });
});

// ─────────────────────────────────────────────
// PUT /api/facturas/:id
// ─────────────────────────────────────────────
describe('PUT /api/facturas/:id', () => {
  test('retorna 200 actualizando estado de la factura creada', async () => {
    const res = await request(app)
      .put(`/api/facturas/${idCreado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'pagada' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Factura actualizada exitosamente.');
    expect(res.body.factura.estado).toBe('pagada');
    expect(res.body.factura).toHaveProperty('items');
  });

  test('el estado cambia a pagada automáticamente al registrar un pago que cubre el total', async () => {
    // El cambio automático de estado ocurre en pagos.service.js (paso 5), disparado
    // por POST /api/pagos, no por este PUT. Se agrupa aquí porque documenta una
    // transición de estado de la factura. Se usa una factura propia (no idCreado)
    // para no interferir con el describe de DELETE.
    const cantidadVendida = 1;

    const facturaRes = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     `JEST-PAGOSTATE-${Date.now()}`,
        fecha_emision:      new Date().toISOString().split('T')[0],
        fecha_vencimiento:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal:           10000,
        impuesto:           1900,
        descuento:          0,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             cantidadVendida,
            valor_unitario:       10000,
          },
        ],
      });

    expect(facturaRes.status).toBe(201);
    const facturaId = facturaRes.body.factura.id_factura;
    const total     = Number(facturaRes.body.factura.total); // 10000 + 1900 - 0 = 11900

    const pagoRes = await request(app)
      .post('/api/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        monto_pagado:                 total,
        fecha_pago:                   new Date().toISOString().split('T')[0],
        metodo_pago:                  'transferencia',
        factura_id_factura:           facturaId,
        usuario_trab_id_usuario_trab: adminId,
      });

    expect(pagoRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/facturas/${facturaId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.estado).toBe('pagada');

    // Limpieza: se elimina el pago y la factura, y se restaura el stock descontado.
    await pool.query('DELETE FROM pago WHERE id_pago = ?', [pagoRes.body.pago.id_pago]);
    await pool.query('DELETE FROM factura WHERE id_factura = ?', [facturaId]);
    await pool.query(
      'UPDATE inventario SET cantidad_disponible = cantidad_disponible + ? WHERE producto_id_producto = ?',
      [cantidadVendida, productoId]
    );
  });

  test('el estado cambia a parcial automáticamente al registrar un pago que no cubre el total', async () => {
    // Mismo mecanismo automático de pagos.service.js (paso 5): si el saldo
    // resultante es mayor a 0, el estado queda en 'parcial'. Se usa una factura
    // propia (no idCreado) para no interferir con el describe de DELETE.
    const cantidadVendida = 1;

    const facturaRes = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero_factura:     `JEST-PAGOPARCIAL-${Date.now()}`,
        fecha_emision:      new Date().toISOString().split('T')[0],
        fecha_vencimiento:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal:           10000,
        impuesto:           1900,
        descuento:          0,
        estado:             'emitida',
        usuario_trab_id:    adminId,
        cliente_id_cliente: clienteId,
        productos: [
          {
            producto_id_producto: productoId,
            cantidad:             cantidadVendida,
            valor_unitario:       10000,
          },
        ],
      });

    expect(facturaRes.status).toBe(201);
    const facturaId = facturaRes.body.factura.id_factura;
    const total     = Number(facturaRes.body.factura.total); // 10000 + 1900 - 0 = 11900
    const montoParcial = total - 1000; // deja saldo pendiente > 0

    const pagoRes = await request(app)
      .post('/api/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        monto_pagado:                 montoParcial,
        fecha_pago:                   new Date().toISOString().split('T')[0],
        metodo_pago:                  'transferencia',
        factura_id_factura:           facturaId,
        usuario_trab_id_usuario_trab: adminId,
      });

    expect(pagoRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/facturas/${facturaId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.estado).toBe('parcial');

    // Limpieza: se elimina el pago y la factura, y se restaura el stock descontado.
    await pool.query('DELETE FROM pago WHERE id_pago = ?', [pagoRes.body.pago.id_pago]);
    await pool.query('DELETE FROM factura WHERE id_factura = ?', [facturaId]);
    await pool.query(
      'UPDATE inventario SET cantidad_disponible = cantidad_disponible + ? WHERE producto_id_producto = ?',
      [cantidadVendida, productoId]
    );
  });
});

// ─────────────────────────────────────────────
// DELETE /api/facturas/:id
// ─────────────────────────────────────────────
describe('DELETE /api/facturas/:id', () => {
  test('retorna 200 eliminando la factura creada', async () => {
    // factura_item tiene ON DELETE CASCADE sobre factura, por lo que los ítems
    // se eliminan automáticamente al borrar la factura sin error de FK.
    const res = await request(app)
      .delete(`/api/facturas/${idCreado}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Factura eliminada exitosamente.');
  });
});
