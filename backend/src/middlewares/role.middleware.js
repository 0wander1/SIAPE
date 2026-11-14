// Utilidades de autorización por rol para el backend.
// verifyToken (auth.middleware) solo comprueba que el JWT sea válido; las funciones de
// este módulo deciden qué puede hacer el usuario autenticado según su cargo.

// Devuelve true si el cargo corresponde a un administrador.
// La comparación ignora mayúsculas y espacios alrededor ('Admin', ' admin ' → true).
// Cualquier valor que no sea string (null, undefined, número, objeto, arreglo) devuelve
// false sin llegar a la comparación, así que trim() y toLowerCase() nunca fallan.
function esAdmin(cargo) {
  // Solo un string puede ser un cargo válido; así un arreglo como ['admin'] no pasa.
  if (typeof cargo !== 'string') return false;
  return cargo.trim().toLowerCase() === 'admin';
}

// Middleware de Express que solo deja pasar a administradores.
// Debe ir después de verifyToken, que es quien coloca en req.user el payload del JWT
// (id, user_name, cargo). Si req.user no existe, req.user?.cargo es undefined y
// esAdmin devuelve false, así que la petición se rechaza en lugar de fallar.
// Uso: router.delete('/:id', verifyToken, requireAdmin, controlador)
function requireAdmin(req, res, next) {
  if (esAdmin(req.user?.cargo)) {
    return next();
  }
  // 403 Forbidden: el usuario está autenticado, pero su cargo no le permite esta acción.
  return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' });
}

// Middleware para PUT /api/trabajadores/:id. Debe ir después de verifyToken.
//   - Un administrador puede editar cualquier trabajador con cualquier campo.
//   - Un trabajador que no es admin solo puede cambiar SU PROPIA contraseña: el id del
//     token debe coincidir con el :id de la URL y el body debe traer exactamente
//     contrasena_actual y nueva_contrasena, sin ningún otro campo. Así no puede tocar
//     cargo, user_name ni el perfil de otros, ni usar el reseteo sin contraseña actual.
// Los ids se comparan como String porque req.params.id siempre es texto y el id del
// JWT es numérico. Si req.user no trae id se rechaza, para que String(undefined) no
// coincida con una URL como /trabajadores/undefined.
function editarTrabajador(req, res, next) {
  if (esAdmin(req.user?.cargo)) {
    return next();
  }

  const claves = Object.keys(req.body ?? {});
  const soloCambioDeContrasena =
    claves.length === 2 &&
    claves.includes('contrasena_actual') &&
    claves.includes('nueva_contrasena');

  if (
    req.user?.id != null &&
    String(req.user.id) === String(req.params.id) &&
    soloCambioDeContrasena
  ) {
    return next();
  }

  return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' });
}

module.exports = { esAdmin, requireAdmin, editarTrabajador };
