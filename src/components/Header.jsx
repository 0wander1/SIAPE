// Barra superior de la aplicación. Muestra el título de la página activa
// y el menú desplegable de perfil del usuario autenticado.

import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import FormField, { Input, FormActions, BtnPrimary, BtnSecondary } from './FormField.jsx';
import api from '../services/api.js';
import styles from './Header.module.css';

// Mapa de rutas a títulos legibles. useLocation() devuelve el pathname actual
// y con este objeto se traduce la ruta a un título para mostrarlo en el header.
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

// Modal de solo lectura que muestra el nombre de usuario y el cargo
// del usuario actualmente en sesión. Los campos están deshabilitados
// porque este modal es únicamente informativo.
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

// Modal para que el usuario cambie su propia contraseña.
// Gestiona su propio estado de formulario, errores y estado de envío.
function CambiarPasswordModal({ user, onClose }) {
  // `form` almacena los tres campos del formulario de cambio de contraseña.
  const [form, setForm]     = useState({ actual: '', nueva: '', confirmar: '' });
  const [error, setError]   = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validación en cliente: las dos contraseñas nuevas deben coincidir
    // antes de enviar la petición al servidor.
    if (form.nueva !== form.confirmar) {
      setError('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    // Validación mínima de longitud antes de hacer el request.
    if (form.nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      // Llama al endpoint PUT /trabajadores/:id con la contraseña actual y la nueva.
      // El backend verifica que la contraseña actual sea correcta antes de actualizarla.
      await api.put(`/trabajadores/${user.id}`, {
        contrasena_actual: form.actual,
        nueva_contrasena:  form.nueva,
      });
      // Si el servidor responde con éxito cierra el modal automáticamente.
      onClose();
    } catch (err) {
      // Muestra el mensaje de error del servidor (p. ej. "Contraseña actual incorrecta")
      // o un mensaje genérico si la respuesta no incluye detalles.
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
  const location = useLocation();
  const navigate = useNavigate();

  // Resuelve el título que se muestra en el header según la ruta activa.
  // Si la ruta no existe en el mapa se usa 'SIAPE' como fallback.
  const title = pageTitles[location.pathname] || 'SIAPE';

  // Lee el objeto del usuario en sesión directamente desde localStorage.
  // Se parsea en cada render para reflejar cambios recientes en los datos del perfil.
  const user = JSON.parse(localStorage.getItem('siape_user') || '{}');

  // `dropdownOpen` controla la visibilidad del menú desplegable del perfil.
  // `modal` indica qué modal está abierto ('perfil', 'password') o null si ninguno.
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modal, setModal]               = useState(null);

  // Referencia al contenedor del dropdown para detectar clics fuera de él.
  const dropdownRef = useRef(null);

  // Cierra el dropdown cuando el usuario hace clic en cualquier parte del documento
  // que esté fuera del contenedor referenciado por dropdownRef.
  // El listener se registra al montar el componente y se elimina al desmontarlo
  // para evitar fugas de memoria.
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
    navigate('/login');
  };

  // Cierra el dropdown y abre el modal indicado por `type`.
  // Cerrar el dropdown primero evita que quede abierto debajo del modal.
  const openModal = (type) => {
    setDropdownOpen(false);
    setModal(type);
  };

  // Genera el avatar de texto con la inicial del nombre de usuario en mayúscula.
  const initials = (user.user_name || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.right}>
          {/*
            Dropdown del perfil:
            El contenedor usa dropdownRef para que el listener de clic exterior
            pueda comparar si el elemento clicado está dentro o fuera.
            El botón alterna dropdownOpen con cada clic; el chevron ▴/▾ indica visualmente
            si el menú está abierto o cerrado.
          */}
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

            {/* El menú se monta/desmonta condicionalmente según dropdownOpen.
                Cada opción llama a openModal() con su tipo o dispara el logout. */}
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

      {/* Renderizado condicional de modales: solo se monta el modal cuyo tipo
          coincide con el valor de `modal`. onClose resetea `modal` a null,
          lo que desmonta el modal y limpia su estado interno. */}
      {modal === 'perfil'   && <PerfilModal          user={user} onClose={() => setModal(null)} />}
      {modal === 'password' && <CambiarPasswordModal user={user} onClose={() => setModal(null)} />}
    </>
  );
}

export default Header;
