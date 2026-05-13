// Punto de entrada de la aplicación React.
// Este archivo monta el árbol de componentes en el nodo <div id="root"> del index.html.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// StrictMode activa advertencias adicionales en desarrollo (doble render intencional,
// detección de efectos secundarios no seguros, APIs obsoletas). No afecta producción.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
