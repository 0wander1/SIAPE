require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { testConnection } = require('./src/config/db');
const routes = require('./src/routes/index');
const { errorHandler } = require('./src/middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api', routes);

// Manejo de errores
app.use(errorHandler);

// Inicio del servidor
testConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor SIAPE corriendo en http://localhost:${PORT}`);
  });
});
