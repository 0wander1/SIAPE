import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockClientes } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Clientes.module.css';

function ClienteModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre_usuario: item?.nombre_usuario ?? '',
    correo:         item?.correo         ?? '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title={item ? 'Editar Cliente' : 'Agregar Cliente'} onClose={onClose} size='sm'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Nombre de Usuario' required>
          <Input
            value={form.nombre_usuario}
            onChange={(e) => setForm({ ...form, nombre_usuario: e.target.value })}
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
  const { isAdmin } = useRole();
  const [clientes, setClientes] = useState(mockClientes);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    api.get('/clientes')
      .then(({ data }) => setClientes(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filtered = clientes.filter(
    (c) =>
      (c.nombre_usuario ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.correo ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const reloadClientes = async () => {
    const { data } = await api.get('/clientes');
    setClientes(data);
  };

  const handleSave = async (form) => {
    try {
      await api.post('/clientes', { nombre_usuario: form.nombre_usuario, correo: form.correo });
      await reloadClientes();
    } catch {
      setClientes((prev) => [...prev, { id: Date.now(), ...form }]);
    }
    setShowModal(false);
  };

  const handleUpdate = async (form) => {
    try {
      await api.put(`/clientes/${editando.id_usuario_cli}`, {
        nombre_usuario: form.nombre_usuario,
        correo: form.correo,
      });
      await reloadClientes();
    } catch (err) {
      console.error(err);
    }
    setEditando(null);
  };

  const handleConfirmDelete = async () => {
    const cliente = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/clientes/${cliente.id_usuario_cli}`);
      await reloadClientes();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error al eliminar el cliente.');
    }
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

      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el cliente <strong>{confirmDelete.nombre_usuario}</strong>? Esta acción no se puede deshacer.</span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>Confirmar</button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className={styles.errorBanner}>
          <span>{errorMsg}</span>
          <button className={styles.errorBannerClose} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id_usuario_cli}>
                <td className={styles.mono}>{c.id_usuario_cli}</td>
                <td className={styles.nombre}>{c.nombre_usuario}</td>
                <td className={styles.correo}>{c.correo}</td>
                <td className={styles.menuCell}>
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id_usuario_cli ? null : c.id_usuario_cli); }}
                      >⋮</button>
                      {menuOpen === c.id_usuario_cli && (
                        <div className={styles.dropdown}>
                          <button onClick={() => { setEditando(c); setMenuOpen(null); }}>✏️ Editar</button>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(c); setMenuOpen(null); }}
                          >🗑️ Eliminar</button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
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

      {editando && (
        <ClienteModal item={editando} onClose={() => setEditando(null)} onSave={handleUpdate} />
      )}
    </div>
  );
}

export default Clientes;
