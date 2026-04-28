import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockTrabajadores } from '../../utils/mockData.js';
import styles from './Trabajadores.module.css';

const emptyForm = {
  nombre: '', cargo: '', direccion: '', turno: 'Mañana',
  celular: '', username: '', password: '', confirmPassword: '',
};

function TrabajadorModal({ onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    onSave(form);
  };

  return (
    <Modal title='Agregar Trabajador' onClose={onClose} size='lg'>
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
          <FormField label='Contraseña' required>
            <Input type='password' name='password' value={form.password}
              onChange={handleChange} placeholder='••••••••' required />
          </FormField>
          <FormField label='Confirmar Contraseña' required>
            <Input type='password' name='confirmPassword' value={form.confirmPassword}
              onChange={handleChange} placeholder='••••••••' required />
          </FormField>
        </FormRow>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Trabajador</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Trabajadores() {
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);

  const handleSave = (form) => {
    setTrabajadores([...trabajadores, {
      id: trabajadores.length + 1,
      nombre: form.nombre,
      cargo: form.cargo,
      direccion: form.direccion,
      turno: form.turno,
      celular: form.celular,
      username: form.username,
    }]);
    setShowModal(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>Equipo de Trabajo</h2>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Trabajador
        </button>
      </div>

      <div className={styles.grid}>
        {trabajadores.map((t) => (
          <div key={t.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.avatar}>
                {t.nombre.charAt(0).toUpperCase()}
              </div>
              <div className={styles.menuWrap}>
                <button
                  className={styles.menuBtn}
                  onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                >⋮</button>
                {menuOpen === t.id && (
                  <div className={styles.dropdown}>
                    <button onClick={() => setMenuOpen(null)}>✏️ Editar</button>
                    <button className={styles.dangerItem} onClick={() => {
                      setTrabajadores(trabajadores.filter((x) => x.id !== t.id));
                      setMenuOpen(null);
                    }}>🗑️ Eliminar</button>
                  </div>
                )}
              </div>
            </div>
            <h4 className={styles.cardName}>{t.nombre}</h4>
            <p className={styles.cardCargo}>{t.cargo}</p>
            <div className={styles.cardDetails}>
              <span className={styles.turno}>{t.turno}</span>
              {t.celular && <span className={styles.celular}>📱 {t.celular}</span>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <TrabajadorModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}

export default Trabajadores;
