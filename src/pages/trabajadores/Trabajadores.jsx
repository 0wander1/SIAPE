import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockTrabajadores } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Trabajadores.module.css';

const emptyForm = {
  nombre: '', cargo: '', direccion: '', turno: 'Mañana',
  celular: '', username: '', password: '', confirmPassword: '',
};

function TrabajadorModal({ onClose, onSave, initialData, isEdit }) {
  const [form, setForm] = useState(initialData ?? emptyForm);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

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

        {error && <div className={styles.errorMsg}>{error}</div>}

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Actualizar Trabajador' : 'Guardar Trabajador'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Trabajadores() {
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editando, setEditando] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

  const openEdit = (t) => {
    setInitialData({
      nombre:          t.nombre ?? '',
      cargo:           t.cargo ?? '',
      direccion:       t.direccion ?? '',
      turno:           t.turno ?? 'Mañana',
      celular:         t.celular ?? '',
      username:        t.user_name ?? '',
      password:        '',
      confirmPassword: '',
    });
    setEditando(t.id_usuario_trab);
    setMenuOpen(null);
    setShowModal(true);
  };

  const handleSave = async (form) => {
    const base = {
      cargo:     form.cargo,
      direccion: form.direccion || null,
      turno:     form.turno    || null,
      celular:   form.celular  || null,
      user_name: form.username,
    };
    try {
      if (editando) {
        await api.put(`/trabajadores/${editando}`, {
          ...base,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.post('/trabajadores', { ...base, password: form.password });
      }
      const { data } = await api.get('/trabajadores');
      setTrabajadores(data);
      closeModal();
    } catch {
      closeModal();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>Equipo de Trabajo</h2>
        <button className={styles.btnNew} onClick={() => { setEditando(null); setInitialData(null); setShowModal(true); }}>
          + Agregar Trabajador
        </button>
      </div>

      <div className={styles.grid}>
        {trabajadores.map((t) => (
          <div key={t.id_usuario_trab ?? t.user_name ?? Math.random()} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.avatar}>
                {(t.nombre || t.user_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className={styles.menuWrap}>
                <button
                  className={styles.menuBtn}
                  onClick={() => setMenuOpen(menuOpen === t.id_usuario_trab ? null : t.id_usuario_trab)}
                >⋮</button>
                {menuOpen === t.id_usuario_trab && (
                  <div className={styles.dropdown}>
                    <button onClick={() => openEdit(t)}>✏️ Editar</button>
                    <button className={styles.dangerItem} onClick={async () => {
                      if (!window.confirm(`¿Eliminar a "${t.nombre || t.user_name}"? Esta acción no se puede deshacer.`)) return;
                      setMenuOpen(null);
                      try {
                        await api.delete(`/trabajadores/${t.id_usuario_trab}`);
                        setTrabajadores((prev) => prev.filter((x) => x.id_usuario_trab !== t.id_usuario_trab));
                      } catch {
                        window.alert('No se pudo eliminar el trabajador. Intenta de nuevo.');
                      }
                    }}>🗑️ Eliminar</button>
                  </div>
                )}
              </div>
            </div>
            <h4 className={styles.cardName}>{t.nombre || t.user_name}</h4>
            <p className={styles.cardCargo}>{t.cargo}</p>
            <div className={styles.cardDetails}>
              <span className={styles.turno}>{t.turno}</span>
              {t.celular && <span className={styles.celular}>📱 {t.celular}</span>}
            </div>
          </div>
        ))}
      </div>

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
