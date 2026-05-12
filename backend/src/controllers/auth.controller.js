// El controlador actúa como intermediario entre la capa de rutas y la de servicios.
// Su responsabilidad es leer la petición HTTP (req), delegar la lógica de negocio
// al servicio correspondiente y formatear la respuesta HTTP (res). No contiene
// consultas a la BD ni reglas de negocio: eso pertenece al servicio.
const authService = require('../services/auth.service');

// Función async porque authService.login devuelve una Promise (realiza consultas a BD).
// El parámetro "next" es el mecanismo de Express para delegar errores al manejador
// global (errorHandler en error.middleware.js) sin necesidad de duplicar lógica de error.
async function login(req, res, next) {
  try {
    // req.body contiene el JSON enviado por el cliente en el cuerpo del POST.
    // La desestructuración extrae exactamente los dos campos que este endpoint necesita.
    // express.json() en server.js ya se encargó de parsear el JSON a objeto JavaScript.
    const { user_name, password } = req.body;

    // Validación de presencia en la capa de controlador: si falta algún campo
    // se responde HTTP 400 (Bad Request) de inmediato. El "return" corta el flujo
    // para que no se siga ejecutando hacia el servicio con datos incompletos.
    if (!user_name || !password) {
      return res.status(400).json({ message: 'user_name y password son requeridos.' });
    }

    // Se delega todo el proceso de autenticación al servicio: búsqueda en BD,
    // verificación de contraseña y generación del JWT. El controlador solo espera
    // el resultado sin conocer los detalles de implementación.
    const result = await authService.login(user_name, password);

    // HTTP 200 OK: las credenciales fueron válidas. Se devuelve el token JWT
    // para que el cliente lo almacene (localStorage o cookie) y lo incluya en
    // el header Authorization de las siguientes peticiones a rutas protegidas.
    // También se devuelve el objeto "user" con datos básicos del usuario autenticado
    // (id, user_name, cargo) para que el front-end pueda mostrarlos sin decodificar el token.
    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    // Si el servicio lanza un error (credenciales incorrectas, BD inaccesible, etc.)
    // se pasa a next(error) en lugar de manejarlo aquí. Express lo redirige al
    // errorHandler global, que ya sabe cómo formatear la respuesta de error con
    // el código HTTP correcto (401 si el servicio adjuntó error.status = 401).
    next(error);
  }
}

module.exports = { login };
