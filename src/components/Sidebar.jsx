// Barra lateral de navegación principal de la aplicación.
// Renderiza los enlaces de navegación filtrados según el rol del usuario
// y el botón para cerrar sesión.

import { NavLink, useNavigate } from 'react-router-dom';
import useRole from '../hooks/useRole.js';
import styles from './Sidebar.module.css';

// Catálogo completo de rutas del sistema. Cada entrada define la ruta,
// la etiqueta visible y el icono que se muestra en el enlace.
// El orden aquí determina el orden visual en la barra lateral.
const navItems = [
  { path: '/dashboard',    label: 'Dashboard',    icon: '▦' },
  { path: '/pedidos',      label: 'Pedidos',      icon: '📦' },
  { path: '/inventario',   label: 'Inventario',   icon: '🗃' },
  { path: '/productos',    label: 'Productos',    icon: '🛒' },
  { path: '/proveedores',  label: 'Proveedores',  icon: '🏭' },
  { path: '/clientes',     label: 'Clientes',     icon: '👥' },
  { path: '/bodegas',      label: 'Bodegas',      icon: '🏠' },
  { path: '/trabajadores', label: 'Trabajadores', icon: '👤' },
  { path: '/facturas',     label: 'Facturas',     icon: '🧾' },
  { path: '/pagos',        label: 'Pagos',        icon: '💳' },
  { path: '/reportes',     label: 'Reportes',     icon: '📊' },
];

// Rutas que solo deben ser visibles para administradores.
// Se centralizan aquí para que agregar una nueva ruta restringida
// solo requiera añadirla a esta lista, sin tocar el JSX.
const ADMIN_ONLY_PATHS = ['/trabajadores', '/reportes'];

function Sidebar() {
  const navigate = useNavigate();

  // isAdmin() proviene del hook useRole, que lee el campo `cargo` del usuario
  // guardado en localStorage y devuelve true si el valor es 'admin'.
  const { isAdmin } = useRole();

  // Limpia los datos de sesión del localStorage y redirige al login.
  // Se llama tanto desde el botón del sidebar como del dropdown del header.
  const handleLogout = () => {
    localStorage.removeItem('siape_token');
    localStorage.removeItem('siape_user');
    navigate('/login');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoText}>SIAPE</span>
        <span className={styles.logoSub}>Gestión Empresarial</span>
      </div>

      <nav className={styles.nav}>
        {/*
          Filtro de navegación por rol:
          - Si el usuario es admin (isAdmin() === true) se muestran todos los items.
          - Si no lo es, se excluyen las rutas declaradas en ADMIN_ONLY_PATHS.
          Esto es solo ocultamiento visual; la protección real está en AdminRoute (App.jsx).
        */}
        {navItems
          .filter((item) => isAdmin() || !ADMIN_ONLY_PATHS.includes(item.path))
          .map((item) => (
            // NavLink aplica automáticamente la clase `active` cuando la URL actual
            // coincide con `item.path`. La función en `className` combina el estilo
            // base del enlace con el estilo de activo cuando corresponde.
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          ))}
      </nav>

      <div className={styles.bottom}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span>⎋</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
