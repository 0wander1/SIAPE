import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import FormField, { Input, FormActions, BtnPrimary, BtnSecondary } from './FormField.jsx';
import api from '../services/api.js';
import styles from './Header.module.css';

const pageTitles = {
  '/dashboard':    'Dashboard',
  '/pedidos':      'Pedidos',
  '/inventario':   'Inventario',
  '/proveedores':  'Proveedores',
  '/clientes':     'Clientes',
  '/bodegas':      'Bodegas',
  '/trabajadores': 'Trabajadores',
  '/facturas':     'Facturas',
  '/pagos':        'Pagos',
  '/reportes':     'Reportes',
  '/productos':    'Productos',
};

function PerfilModal({ user, onClose }) {
  return (
    <Modal title='Mi Perfil' onClose={onClose} size='sm'>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Usuario'>
          <Input value={user.user_name || '—'} disabled />
        </FormField>
        <FormField label='Cargo'>
          <Input value={user.cargo || '—'} disabled />
        </FormField>
        <FormActions>
          <BtnPrimary type='button' onClick={onClose}>Cerrar</BtnPrimary>
        </FormActions>
      </div>
    </Modal>
  );
}

function CambiarPasswordModal({ user, onClose }) {
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.nueva !== form.confirmar) {
      setError('La nueva contraseña y la confirmación no coinciden.');
      return;
    }
    if (form.nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/trabajadores/${user.id}`, {
        contrasena_actual: form.actual,
        nueva_contrasena:  form.nueva,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title='Cambiar Contraseña' onClose={onClose} size='sm'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Contraseña actual' required>
          <Input
            type='password'
            value={form.actual}
            onChange={(e) => setForm({ ...form, actual: e.target.value })}
            required
          />
        </FormField>
        <FormField label='Nueva contraseña' required>
          <Input
            type='password'
            value={form.nueva}
            onChange={(e) => setForm({ ...form, nueva: e.target.value })}
            required
          />
        </FormField>
        <FormField label='Confirmar nueva contraseña' required>
          <Input
            type='password'
            value={form.confirmar}
            onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
            required
          />
        </FormField>
        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit' disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Header() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const title     = pageTitles[location.pathname] || 'SIAPE';
  const user      = JSON.parse(localStorage.getItem('siape_user') || '{}');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modal, setModal]               = useState(null);
  const dropdownRef                     = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('siape_token');
    localStorage.removeItem('siape_user');
    navigate('/');
  };

  const openModal = (type) => {
    setDropdownOpen(false);
    setModal(type);
  };

  const initials = (user.user_name || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.right}>
          <div className={styles.profileWrap} ref={dropdownRef}>
            <button
              type='button'
              className={styles.userInfo}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{user.user_name || 'Usuario'}</span>
                <span className={styles.userRole}>{user.cargo || '—'}</span>
              </div>
              <span className={styles.chevron}>{dropdownOpen ? '▴' : '▾'}</span>
            </button>

            {dropdownOpen && (
              <div className={styles.profileDropdown}>
                <button onClick={() => openModal('perfil')}>👤 Ver perfil</button>
                <button onClick={() => openModal('password')}>🔑 Cambiar contraseña</button>
                <hr className={styles.divider} />
                <button className={styles.logoutItem} onClick={handleLogout}>⎋ Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {modal === 'perfil'    && <PerfilModal          user={user} onClose={() => setModal(null)} />}
      {modal === 'password'  && <CambiarPasswordModal user={user} onClose={() => setModal(null)} />}
    </>
  );
}

export default Header;
