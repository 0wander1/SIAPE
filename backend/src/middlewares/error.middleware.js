// errorHandler es el manejador global de errores de la aplicación Express.
// Express lo distingue de un middleware normal por tener exactamente 4 parámetros:
// (err, req, res, next). Cuando cualquier ruta o middleware llama a next(err) pasando
// un objeto de error, Express salta todos los middlewares normales y lo entrega
// directamente a esta función. Por eso debe registrarse al final de server.js,
// después de todas las rutas: app.use(errorHandler).
function errorHandler(err, req, res, next) {
  // err.stack contiene el mensaje de error junto con la traza completa de llamadas
  // (archivo, línea y función). Se imprime en la consola del servidor para facilitar
  // el diagnóstico en desarrollo; en producción convendría enviarlo a un sistema de
  // logging (Winston, Sentry, etc.) en lugar de mostrarlo directamente en la terminal.
  console.error(err.stack);

  // Se usa el código HTTP que el error traiga explícitamente (err.status), si existe.
  // Esto permite que los controladores lancen errores personalizados con su propio código:
  //   const error = new Error('No encontrado'); error.status = 404; next(error);
  // Si el error no define un status (por ejemplo, un TypeError inesperado), se usa 500
  // (Internal Server Error) como valor por defecto seguro.
  const status = err.status || 500;

  // Se responde al cliente con el código HTTP resuelto y un JSON con el mensaje de error.
  // err.message es la descripción legible del problema; si no existe (error sin mensaje)
  // se usa una cadena genérica para no exponer detalles internos al cliente.
  // Centralizar la respuesta de error aquí garantiza que todos los errores de la API
  // tengan siempre el mismo formato JSON, simplificando el manejo en el front-end.
  res.status(status).json({
    message: err.message || 'Error interno del servidor.',
  });
}

// Se exporta errorHandler para que server.js lo registre como el último middleware
// de la cadena y capture cualquier error que no haya sido manejado antes.
module.exports = { errorHandler };
