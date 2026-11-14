const request  = require('supertest');
const app      = require('../../server');
const { pool } = require('../../src/config/db');
const jwt      = require('jsonwebtoken');

// Los tokens se firman directamente con JWT_SECRET en lugar de pasar por el login en dos
// pasos: así los tests de roles no dependen de usuarios reales en la base de datos.
// verifyToken solo comprueba la firma y la expiración, y requireAdmin lee el cargo del
// payload, por lo que estos tokens bastan para ejercitar la autorización.
const tokenAdmin = jwt.sign(
  { id: 1, user_name: 'admin_test', cargo: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenNoAdmin = jwt.sign(
  { id: 2, user_name: 'colab_test', cargo: 'Bodeguero' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────
// requireAdmin
// ─────────────────────────────────────────────
describe('requireAdmin', () => {
  test('POST /api/bodegas con token no administrador responde 403', async () => {
    // El body vacío no llega a validarse: requireAdmin responde antes de que la
    // petición alcance el controlador, así que no se toca la base de datos.
    const res = await request(app)
      .post('/api/bodegas')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No tienes permisos para realizar esta acción.');
  });

  test('POST /api/bodegas con token administrador pasa el control de roles y responde 400', async () => {
    // Un 400 (y no 403) confirma que requireAdmin dejó pasar la petición y que fue el
    // controlador quien la rechazó por campos faltantes. El controlador valida antes de
    // llamar al servicio, así que tampoco aquí se toca la base de datos.
    const res = await request(app)
      .post('/api/bodegas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('POST /api/facturas con token no administrador pasa el control de roles y responde 400', async () => {
    // POST /api/facturas no lleva requireAdmin: cualquier trabajador autenticado puede
    // facturar. Un 400 (y no 403) confirma que la petición llegó al controlador, que
    // rechaza por campos faltantes antes de llamar al servicio, sin tocar la base de datos.
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('POST /api/clientes con token no administrador pasa el control de roles y responde 400', async () => {
    // POST /api/clientes no lleva requireAdmin: cualquier trabajador autenticado puede
    // registrar clientes. Un 400 (y no 403) confirma que la petición llegó al controlador,
    // que rechaza por campos faltantes antes de llamar al servicio, sin tocar la BD.
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('DELETE /api/facturas/:id con token no administrador responde 403', async () => {
    // DELETE /api/facturas/:id lleva requireAdmin: un no administrador no puede eliminar
    // facturas. requireAdmin responde antes del controlador, así que la factura 1 no
    // necesita existir y no se toca la base de datos.
    const res = await request(app)
      .delete('/api/facturas/1')
      .set('Authorization', `Bearer ${tokenNoAdmin}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No tienes permisos para realizar esta acción.');
  });

  test('DELETE /api/pedidos/:id con token no administrador responde 403', async () => {
    // DELETE /api/pedidos/:id lleva requireAdmin: un no administrador no puede eliminar
    // pedidos. requireAdmin responde antes del controlador, así que el pedido 1 no
    // necesita existir y no se toca la base de datos.
    const res = await request(app)
      .delete('/api/pedidos/1')
      .set('Authorization', `Bearer ${tokenNoAdmin}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No tienes permisos para realizar esta acción.');
  });
});

// ─────────────────────────────────────────────
// editarTrabajador
// ─────────────────────────────────────────────
describe('editarTrabajador', () => {
  test('PUT /api/trabajadores/:id propio con { cargo: "admin" } y token no administrador responde 403', async () => {
    // El id de la URL coincide con el del token (2), pero el body no es exactamente
    // { contrasena_actual, nueva_contrasena }: un no administrador no puede cambiar su
    // propio cargo. editarTrabajador responde antes del controlador, sin tocar la BD.
    const res = await request(app)
      .put('/api/trabajadores/2')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({ cargo: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No tienes permisos para realizar esta acción.');
  });

  test('PUT /api/trabajadores/:id de otro trabajador con { password } y token no administrador responde 403', async () => {
    // El token es del trabajador 2 y la URL apunta al 1: un no administrador no puede
    // usar el reseteo de contraseña (Modo C, sin contrasena_actual) sobre otra cuenta.
    // editarTrabajador responde antes del controlador, sin tocar la BD.
    const res = await request(app)
      .put('/api/trabajadores/1')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({ password: 'cualquiera123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No tienes permisos para realizar esta acción.');
  });

  test('PUT /api/trabajadores/:id propio con solo contrasena_actual y nueva_contrasena y token no administrador no responde 403', async () => {
    // El id coincide con el del token (2) y el body trae exactamente los dos campos de
    // cambio de contraseña, así que editarTrabajador deja pasar la petición.
    // A diferencia de los demás tests de este archivo, este SÍ llega al servicio, que hace
    // un SELECT de solo lectura del password_hash del trabajador 2:
    //   - si no existe → 404;
    //   - si existe, bcrypt.compare('x', hash) falla → 401.
    // Solo se ejecutaría un UPDATE si la contraseña real del trabajador 2 fuera 'x'.
    // Por eso se verifica únicamente que la respuesta no sea 403.
    const res = await request(app)
      .put('/api/trabajadores/2')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({ contrasena_actual: 'x', nueva_contrasena: 'y' });

    expect(res.status).not.toBe(403);
  });
});
