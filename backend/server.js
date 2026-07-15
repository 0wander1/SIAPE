// dotenv lee el archivo .env de la raíz del proyecto e inyecta cada línea "CLAVE=VALOR"
// en process.env antes de que cualquier otro módulo intente leer variables de entorno.
// Debe ser la primera línea ejecutada para que db.js y el resto encuentren sus variables.
require('dotenv').config();

// Express es el framework HTTP que gestiona el enrutamiento, middlewares y respuestas.
const express = require('express');
// cors habilita el intercambio de recursos entre distintos orígenes (Cross-Origin Resource
// Sharing), necesario para que el front-end (servido en un puerto o dominio distinto) pueda
// hacer peticiones a esta API sin que el navegador las bloquee.
const cors = require('cors');

// testConnection verifica la conexión a MySQL antes de aceptar peticiones HTTP.
const { testConnection } = require('./src/config/db');
// routes es el enrutador raíz que agrupa todas las rutas de la aplicación
// (productos, clientes, facturas, etc.) definidas en src/routes/index.js.
const routes = require('./src/routes/index');
// errorHandler es un middleware de Express especial (4 parámetros: err, req, res, next)
// que captura cualquier error no manejado y devuelve una respuesta JSON uniforme.
const { errorHandler } = require('./src/middlewares/error.middleware');

// Se crea la instancia principal de la aplicación Express.
const app = express();
// El puerto se lee desde la variable de entorno PORT para facilitar el despliegue en
// servicios cloud (Heroku, Railway, etc.) que asignan el puerto dinámicamente.
// Si no está definida, se usa 3000 como valor por defecto para desarrollo local.
const PORT = process.env.PORT || 3000;

// Middlewares globales — se ejecutan en orden para cada petición entrante:

// cors() añade las cabeceras HTTP necesarias (Access-Control-Allow-Origin, etc.)
// para que los navegadores permitan peticiones desde el front-end.
app.use(cors());
// express.json() parsea el cuerpo de las peticiones con Content-Type application/json
// y lo pone disponible en req.body como objeto JavaScript.
app.use(express.json());
// express.urlencoded() parsea cuerpos con formato de formulario HTML (application/x-www-form-urlencoded).
// { extended: true } permite valores anidados usando la librería qs en lugar de querystring.
app.use(express.urlencoded({ extended: true }));

// Registro de rutas: todas las rutas definidas en src/routes/index.js quedan
// disponibles bajo el prefijo "/api" (por ejemplo /api/productos, /api/clientes).
// Centralizar el prefijo aquí evita repetirlo en cada definición de ruta individual.
app.use('/api', routes);

// El errorHandler debe registrarse después de todas las rutas para que Express
// lo invoque únicamente cuando alguna ruta o middleware anterior llame a next(err).
app.use(errorHandler);

// Cuando el archivo se ejecuta directamente (node server.js), primero se valida
// la conexión a MySQL y solo entonces se abre el puerto. Al importar server.js
// desde los tests, este bloque no se ejecuta y la DB no se toca.
if (require.main === module) {
  testConnection().then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor SIAPE corriendo en http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
