import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockClientes } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Clientes.module.css';

function ClienteModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nombre: '', correo: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Agregar Cliente' onClose={onClose} size='sm'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Nombre de Usuario' required>
          <Input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder='Nombre completo o razón social'
            required
          />
        </FormField>
        <FormField label='Correo Electrónico' required>
          <Input
            type='email'
            value={form.correo}
            onChange={(e) => setForm({ ...form, correo: e.target.value })}
            placeholder='correo@empresa.com'
            required
          />
        </FormField>
        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Cliente</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Clientes() {
  const [clientes, setClientes] = useState(mockClientes);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.get('/clientes')
      .then(({ data }) => setClientes(data))
      .catch(() => {});
  }, []);

  const filtered = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.correo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (form) => {
    setClientes([...clientes, { id: clientes.length + 1, ...form }]);
    setShowModal(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre o correo...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Cliente
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className={styles.mono}>{c.id}</td>
                <td className={styles.nombre}>{c.nombre}</td>
                <td className={styles.correo}>{c.correo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className={styles.empty}>No se encontraron clientes.</p>
        )}
      </div>

      {showModal && (
        <ClienteModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}

export default Clientes;
