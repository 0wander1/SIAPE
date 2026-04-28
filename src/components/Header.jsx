import { useLocation } from 'react-router-dom';
import styles from './Header.module.css';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/pedidos': 'Pedidos',
  '/inventario': 'Inventario',
  '/proveedores': 'Proveedores',
  '/clientes': 'Clientes',
  '/bodegas': 'Bodegas',
  '/trabajadores': 'Trabajadores',
  '/facturas': 'Facturas',
  '/pagos': 'Pagos',
  '/reportes': 'Reportes',
};

function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'SIAPE';
  const user = JSON.parse(localStorage.getItem('siape_user') || '{"name":"Admin"}');

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>{user.name || 'Admin'}</span>
            <span className={styles.userRole}>{user.role || 'Administrador'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
