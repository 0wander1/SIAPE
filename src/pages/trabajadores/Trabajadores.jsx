// Página de gestión del equipo de trabajo. Muestra los trabajadores en vista
// de tarjetas (grid) en lugar de tabla, ya que el número de empleados suele
// ser reducido y el formato de tarjeta comunica mejor la identidad de cada persona.
//
// Acceso exclusivo para administradores: esta ruta está envuelta en <AdminRoute>
// dentro de App.jsx, que verifica que user.cargo === 'admin' antes de renderizarla.
// Si un usuario sin ese cargo intenta acceder directamente por URL, AdminRoute lo
// redirige al dashboard. Por eso este componente no importa useRole ni aplica
// ningún control de visibilidad propio: la protección ya ocurrió más arriba en el árbol.

import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockTrabajadores } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Trabajadores.module.css';

// Valores iniciales del formulario en modo creación.
// `password` y `confirmPassword` siempre parten vacíos, también en edición,
// para que el administrador no vea ni sobreescriba la contraseña actual
// a menos que quiera cambiarla explícitamente.
const emptyForm = {
  nombre: '', cargo: '', direccion: '', turno: 'Mañana',
  celular: '', correo: '', username: '', password: '', confirmPassword: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de trabajador
// ─────────────────────────────────────────────────────────────────────────────
function TrabajadorModal({ onClose, onSave, initialData, isEdit }) {
  const [form, setForm] = useState(initialData ?? emptyForm);
  // `error` muestra mensajes de validación de contraseña dentro del modal.
  const [error, setError] = useState('');

  // Limpia el error en cada pulsación para que no persista después de que
  // el usuario empiece a corregir el campo que lo originó.
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // Validación de contraseñas antes de delegar al padre.
  // La lógica tiene dos ramas según el modo:
  //
  // Creación (!isEdit):
  //   - La contraseña es obligatoria (el input tiene required={!isEdit}).
  //   - Las dos contraseñas deben coincidir.
  //
  // Edición (isEdit) con nueva contraseña (form.password no vacío):
  //   - Si el administrador escribe algo en el campo, se valida que coincida
  //     con el campo de confirmación antes de enviarlo.
  //   - Si ambos campos están vacíos, el payload omite `password` y el backend
  //     conserva la contraseña actual sin cambios.
  //
  // El bloque `if (!isEdit || form.password)` cubre ambos casos:
  //   - En creación siempre entra (isEdit es false → !isEdit es true).
  //   - En edición entra solo si se escribió una nueva contraseña.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isEdit || form.password) {
      if (form.password !== form.confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (!isEdit && !form.password) {
        setError('La contraseña es requerida.');
        return;
      }
    }
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'Editar Trabajador' : 'Agregar Trabajador'} onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormRow>
          <FormField label='Nombre Completo' required>
            <Input name='nombre' value={form.nombre} onChange={handleChange}
              placeholder='Nombre y apellidos' required />
          </FormField>
          <FormField label='Cargo' required>
            <Input name='cargo' value={form.cargo} onChange={handleChange}
              placeholder='Ej. Bodeguero' required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Dirección'>
            <Input name='direccion' value={form.direccion} onChange={handleChange}
              placeholder='Cra 5 #10-20' />
          </FormField>
          <FormField label='Celular'>
            <Input name='celular' value={form.celular} onChange={handleChange}
              placeholder='300 000 0000' />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Turno'>
            <Select name='turno' value={form.turno} onChange={handleChange}>
              <option value='Mañana'>Mañana</option>
              <option value='Tarde'>Tarde</option>
              <option value='Noche'>Noche</option>
              <option value='Completo'>Completo</option>
            </Select>
          </FormField>
          <FormField label='Username' required>
            <Input name='username' value={form.username} onChange={handleChange}
              placeholder='usuario123' required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Correo Electrónico'>
            <Input type='email' name='correo' value={form.correo} onChange={handleChange}
              placeholder='correo@ejemplo.com' />
          </FormField>
        </FormRow>

        {/*
          Campos de contraseña con comportamiento diferente según el modo:
          - Creación: obligatorios (required={!isEdit}), placeholder estándar.
          - Edición:  opcionales, placeholder 'Dejar vacío para no cambiar'
            para indicar al administrador que puede omitirlos si no desea
            modificar la contraseña actual del trabajador.
        */}
        <FormRow>
          <FormField label={isEdit ? 'Nueva Contraseña' : 'Contraseña'} required={!isEdit}>
            <Input type='password' name='password' value={form.password}
              onChange={handleChange} placeholder={isEdit ? 'Dejar vacío para no cambiar' : '••••••••'}
              required={!isEdit} />
          </FormField>
          <FormField label='Confirmar Contraseña' required={!isEdit}>
            <Input type='password' name='confirmPassword' value={form.confirmPassword}
              onChange={handleChange} placeholder='••••••••' required={!isEdit} />
          </FormField>
        </FormRow>

        {/* Mensaje de error de validación de contraseñas; se limpia en cada cambio */}
        {error && <div className={styles.errorMsg}>{error}</div>}

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Actualizar Trabajador' : 'Guardar Trabajador'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Trabajadores() {
  // Inicializado con mock data para que el grid no quede vacío mientras llega la API.
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [showModal, setShowModal]       = useState(false);

  // `menuOpen` guarda el id_usuario_trab del menú ⋮ abierto en la tarjeta activa.
  const [menuOpen, setMenuOpen] = useState(null);

  // `editando` guarda el id_usuario_trab que se está editando (null en creación).
  const [editando, setEditando]       = useState(null);
  // `initialData` contiene los valores normalizados para pre-llenar el formulario.
  const [initialData, setInitialData] = useState(null);

  // `confirmDelete` almacena el trabajador pendiente de eliminar.
  const [confirmDelete, setConfirmDelete] = useState(null);
  // `errorMsg` alimenta el banner de error rojo con auto-cierre.
  const [errorMsg, setErrorMsg] = useState('');

  // ── Carga inicial de trabajadores ─────────────────────────────────────────
  // Reemplaza los datos mock con los reales del servidor al montar.
  // El catch vacío preserva los mock si el backend no está disponible.
  useEffect(() => {
    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  // Cierra el modal y limpia el estado de edición para que la próxima
  // apertura arranque siempre en modo creación con formulario vacío.
  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

  // Normaliza los campos del trabajador antes de pasarlos al formulario:
  // - `password` y `confirmPassword` siempre vacíos en edición: el administrador
  //   solo los rellena si quiere cambiar la contraseña; si los deja vacíos,
  //   handleSave omitirá `password` del payload y el backend no la modificará.
  // - `user_name` del backend se mapea a `username` del formulario para consistencia
  //   con el campo `name` del input.
  const openEdit = (t) => {
    setInitialData({
      nombre:          t.nombre ?? '',
      cargo:           t.cargo ?? '',
      direccion:       t.direccion ?? '',
      turno:           t.turno ?? 'Mañana',
      celular:         t.celular ?? '',
      correo:          t.correo ?? '',
      username:        t.user_name ?? '',
      password:        '',
      confirmPassword: '',
    });
    setEditando(t.id_usuario_trab);
    setMenuOpen(null);
    setShowModal(true);
  };

  // ── Eliminación con confirmación ──────────────────────────────────────────
  // Se invoca solo cuando el usuario confirma en el banner.
  // 1. Cierra el banner de inmediato para evitar doble clic.
  // 2. Envía DELETE /trabajadores/:id.
  // 3. Si tiene éxito, filtra el trabajador del estado local sin recargar.
  // 4. Si falla, muestra el mensaje del backend en el banner de error rojo.
  const handleConfirmDelete = async () => {
    const t = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/trabajadores/${t.id_usuario_trab}`);
      setTrabajadores((prev) => prev.filter((x) => x.id_usuario_trab !== t.id_usuario_trab));
    } catch (error) {
      const msg = error.response?.data?.message || 'No se pudo eliminar el trabajador.';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // ── Guardar trabajador (crear o editar) ───────────────────────────────────
  const handleSave = async (form) => {
    // Campos comunes a creación y edición.
    // Los opcionales se convierten a null si están vacíos para que el backend
    // los trate como ausentes y no los guarde como strings vacíos.
    const base = {
      nombre:    form.nombre,
      cargo:     form.cargo,
      direccion: form.direccion || null,
      turno:     form.turno    || null,
      celular:   form.celular  || null,
      correo:    form.correo   || null,
      user_name: form.username,
    };
    try {
      if (editando) {
        // En edición, `password` solo se incluye en el payload si el administrador
        // escribió una nueva contraseña. El spread condicional `...(form.password ? {...} : {})`
        // omite la clave por completo cuando el campo está vacío, de modo que el backend
        // no interpreta un password vacío como una instrucción de borrado.
        await api.put(`/trabajadores/${editando}`, {
          ...base,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        // En creación, `password` siempre se incluye (es obligatorio en el modal).
        await api.post('/trabajadores', { ...base, password: form.password });
      }
      // Recarga la lista completa para mostrar los datos definitivos del servidor.
      const { data } = await api.get('/trabajadores');
      setTrabajadores(data);
      closeModal();
    } catch {
      closeModal();
    }
  };

  return (
    <div className={styles.page}>
      {errorMsg && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
          borderRadius: 8, padding: '10px 16px', fontSize: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg('')}
            style={{ background: 'none', color: '#dc2626', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
          >✕</button>
        </div>
      )}

      <div className={styles.topBar}>
        <h2 className={styles.heading}>Equipo de Trabajo</h2>
        {/* Resetea editando e initialData para garantizar modo creación */}
        <button className={styles.btnNew} onClick={() => { setEditando(null); setInitialData(null); setShowModal(true); }}>
          + Agregar Trabajador
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          El nombre mostrado usa `confirmDelete.nombre || confirmDelete.user_name`
          porque algunos trabajadores mock solo tienen user_name sin nombre completo. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar a <strong>{confirmDelete.nombre || confirmDelete.user_name}</strong>? Esta acción no se puede deshacer.</span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>Confirmar</button>
          </div>
        </div>
      )}

      {/*
        Vista en tarjetas (grid).
        Cada tarjeta muestra el avatar con la inicial del nombre, el cargo, el turno
        y el celular (solo si está disponible). Este layout es preferible a una tabla
        para datos de personas: facilita identificar visualmente a cada trabajador
        y escala mejor a pantallas medianas sin necesidad de scroll horizontal.

        La key usa `id_usuario_trab ?? user_name ?? Math.random()` como fallback
        progresivo: los datos mock pueden no tener id_usuario_trab, pero sí user_name.
        Math.random() es el último recurso para evitar warnings de React en desarrollo;
        no afecta rendimiento porque el array de trabajadores es pequeño y estático.
      */}
      <div className={styles.grid}>
        {trabajadores.map((t) => (
          <div key={t.id_usuario_trab ?? t.user_name ?? Math.random()} className={styles.card}>
            <div className={styles.cardHeader}>
              {/* Avatar de texto con la inicial en mayúscula del nombre o username */}
              <div className={styles.avatar}>
                {(t.nombre || t.user_name || '?').charAt(0).toUpperCase()}
              </div>

              {/*
                Menú de tres puntos dentro de la tarjeta.
                No hay listener global de click-outside en este componente: el menú
                se cierra al elegir una acción (setMenuOpen(null) explícito) o al
                abrir el de otra tarjeta (el toggle reemplaza menuOpen con el nuevo ID).
                El toggle usa `menuOpen === t.id_usuario_trab` para abrir/cerrar
                el menú del trabajador actual sin afectar los demás.
              */}
              <div className={styles.menuWrap}>
                <button
                  className={styles.menuBtn}
                  onClick={() => setMenuOpen(menuOpen === t.id_usuario_trab ? null : t.id_usuario_trab)}
                >⋮</button>
                {menuOpen === t.id_usuario_trab && (
                  <div className={styles.dropdown}>
                    <button onClick={() => openEdit(t)}>✏️ Editar</button>
                    <button
                      className={styles.dangerItem}
                      onClick={() => { setConfirmDelete(t); setMenuOpen(null); }}
                    >🗑️ Eliminar</button>
                  </div>
                )}
              </div>
            </div>

            <h4 className={styles.cardName}>{t.nombre || t.user_name}</h4>
            <p className={styles.cardCargo}>{t.cargo}</p>
            <div className={styles.cardDetails}>
              <span className={styles.turno}>{t.turno}</span>
              {/* El celular se muestra condicionalmente; algunos trabajadores no lo tienen */}
              {t.celular && <span className={styles.celular}>📱 {t.celular}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* El modal se monta condicionalmente para que al cerrarse su estado
          interno (formulario y error) se destruya automáticamente. */}
      {showModal && (
        <TrabajadorModal
          onClose={closeModal}
          onSave={handleSave}
          initialData={initialData}
          isEdit={!!editando}
        />
      )}
    </div>
  );
}

export default Trabajadores;
