// Componente raíz que define el sistema de rutas de toda la aplicación
// usando React Router v6 (BrowserRouter + Routes + Route).

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/login/Login.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Pedidos from './pages/pedidos/Pedidos.jsx';
import Inventario from './pages/inventario/Inventario.jsx';
import Proveedores from './pages/proveedores/Proveedores.jsx';
import Clientes from './pages/clientes/Clientes.jsx';
import Bodegas from './pages/bodegas/Bodegas.jsx';
import Trabajadores from './pages/trabajadores/Trabajadores.jsx';
import Facturas from './pages/facturas/Facturas.jsx';
import Pagos from './pages/pagos/Pagos.jsx';
import Productos from './pages/productos/Productos.jsx';
import Reportes from './pages/reportes/Reportes.jsx';

// Comprueba si el usuario tiene sesión activa buscando el JWT en localStorage.
// Devuelve true si el token existe, false en caso contrario.
const isAuthenticated = () => {
  return localStorage.getItem('siape_token') !== null;
};

// Guardia de ruta para usuarios autenticados.
// Si hay sesión activa renderiza el componente hijo; de lo contrario redirige a /login
// usando `replace` para no dejar la ruta protegida en el historial del navegador.
const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to='/login' replace />;
};

// Comprueba si el usuario autenticado tiene rol de administrador
// leyendo el objeto siape_user guardado en localStorage y verificando el campo `cargo`.
const isAdmin = () => {
  const raw = localStorage.getItem('siape_user');
  const user = raw ? JSON.parse(raw) : null;
  return user?.cargo === 'admin';
};

// Guardia de ruta exclusiva para administradores.
// Si el usuario es admin renderiza el componente hijo;
// de lo contrario lo redirige al dashboard sin exponer la ruta restringida.
const AdminRoute = ({ children }) => {
  return isAdmin() ? children : <Navigate to='/dashboard' replace />;
};

function App() {
  return (
    // BrowserRouter habilita el enrutamiento basado en la API History del navegador
    // (URLs limpias sin hash, p. ej. /dashboard en lugar de /#/dashboard).
    <BrowserRouter>
      <Routes>
        {/* Ruta pública: accesible sin sesión */}
        <Route path='/login' element={<Login />} />

        {/* Ruta raíz protegida: PrivateRoute verifica la sesión antes de renderizar Layout.
            Layout actúa como shell compartido (barra de navegación, sidebar, etc.) y
            expone un <Outlet> donde React Router inyecta las rutas hijas activas. */}
        <Route
          path='/'
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Ruta índice: redirige la raíz "/" directamente al dashboard */}
          <Route index element={<Navigate to='/dashboard' replace />} />

          {/* Rutas accesibles para cualquier usuario autenticado */}
          <Route path='dashboard' element={<Dashboard />} />
          <Route path='pedidos' element={<Pedidos />} />
          <Route path='inventario' element={<Inventario />} />
          <Route path='productos' element={<Productos />} />
          <Route path='proveedores' element={<Proveedores />} />
          <Route path='clientes' element={<Clientes />} />
          <Route path='bodegas' element={<Bodegas />} />

          {/* Rutas restringidas a administradores: AdminRoute comprueba el cargo del usuario */}
          <Route path='trabajadores' element={<AdminRoute><Trabajadores /></AdminRoute>} />
          <Route path='facturas' element={<Facturas />} />
          <Route path='pagos' element={<Pagos />} />
          <Route path='reportes' element={<AdminRoute><Reportes /></AdminRoute>} />
        </Route>

        {/* Ruta comodín: cualquier URL desconocida redirige al dashboard */}
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
