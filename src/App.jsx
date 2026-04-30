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

const isAuthenticated = () => {
  return localStorage.getItem('siape_token') !== null;
};

const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to='/login' replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route
          path='/'
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to='/dashboard' replace />} />
          <Route path='dashboard' element={<Dashboard />} />
          <Route path='pedidos' element={<Pedidos />} />
          <Route path='inventario' element={<Inventario />} />
          <Route path='productos' element={<Productos />} />
          <Route path='proveedores' element={<Proveedores />} />
          <Route path='clientes' element={<Clientes />} />
          <Route path='bodegas' element={<Bodegas />} />
          <Route path='trabajadores' element={<Trabajadores />} />
          <Route path='facturas' element={<Facturas />} />
          <Route path='pagos' element={<Pagos />} />
          <Route path='reportes' element={<Reportes />} />
        </Route>
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
