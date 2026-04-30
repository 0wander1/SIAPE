import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '▦' },
  { path: '/pedidos', label: 'Pedidos', icon: '📦' },
  { path: '/inventario', label: 'Inventario', icon: '🗃' },
  { path: '/productos', label: 'Productos', icon: '🛒' },
  { path: '/proveedores', label: 'Proveedores', icon: '🏭' },
  { path: '/clientes', label: 'Clientes', icon: '👥' },
  { path: '/bodegas', label: 'Bodegas', icon: '🏠' },
  { path: '/trabajadores', label: 'Trabajadores', icon: '👤' },
  { path: '/facturas', label: 'Facturas', icon: '🧾' },
  { path: '/pagos', label: 'Pagos', icon: '💳' },
  { path: '/reportes', label: 'Reportes', icon: '📊' },
];

function Sidebar() {
  const navigate = useNavigate();

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
        {navItems.map((item) => (
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
