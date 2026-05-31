// Cliente HTTP centralizado construido sobre Axios.
// Todos los módulos de la aplicación importan esta instancia para
// comunicarse con el backend; esto garantiza que la baseURL,
// el timeout y los interceptores se apliquen de forma uniforme.

import axios from 'axios';

// Instancia de Axios preconfigurada con la URL base del backend y un
// tiempo de espera máximo de 10 segundos por petición.
const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  timeout: 10000,
});

// Interceptor de petición: se ejecuta antes de que cada request salga al servidor.
// Recupera el JWT almacenado en localStorage y, si existe, lo adjunta en la
// cabecera Authorization siguiendo el esquema Bearer, que es el que valida el backend.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('siape_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta: se ejecuta cuando el servidor devuelve una respuesta.
// - Respuesta exitosa (2xx): la deja pasar sin modificaciones.
// - Error 401 (No autorizado / token expirado o inválido): limpia los datos de sesión
//   del localStorage y fuerza una redirección a la raíz "/" para que el usuario
//   vuelva a autenticarse. Se usa window.location.href en lugar de navigate() porque
//   este módulo vive fuera del árbol de componentes de React Router.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/verify-code') || url.includes('/trabajadores');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('siape_token');
      localStorage.removeItem('siape_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
