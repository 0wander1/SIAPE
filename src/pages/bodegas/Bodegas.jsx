import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockBodegas, mockTrabajadores } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Bodegas.module.css';

const emptyForm = {
  descripcion: '', ubicacion: '', ciudad: '', capacidadMaxima: '',
  capacidadActual: '', tipo: 'Seca', estado: true, trabajador: '',
};

function BodegaModal({ onClose, onSave, trabajadores, initialData, isEdit }) {
  const [form, setForm] = useState(initialData ?? emptyForm);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'Editar Bodega' : 'Agregar Bodega'} onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Descripción' required>
          <Input name='descripcion' value={form.descripcion} onChange={handleChange}
            placeholder='Ej. Bodega Principal' required />
        </FormField>

        <FormRow>
          <FormField label='Ubicación' required>
            <Input name='ubicacion' value={form.ubicacion} onChange={handleChange}
              placeholder='Cra 10 #20-30' required />
          </FormField>
          <FormField label='Ciudad' required>
            <Input name='ciudad' value={form.ciudad} onChange={handleChange}
              placeholder='Bogotá' required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Capacidad Máxima' required>
            <Input type='number' name='capacidadMaxima' min='1'
              value={form.capacidadMaxima} onChange={handleChange} required />
          </FormField>
          <FormField label='Capacidad Actual'>
            <Input type='number' name='capacidadActual' min='0'
              value={form.capacidadActual} onChange={handleChange} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Tipo'>
            <Select name='tipo' value={form.tipo} onChange={handleChange}>
              <option value='Seca'>Seca</option>
              <option value='Refrigerada'>Refrigerada</option>
              <option value='Congelada'>Congelada</option>
            </Select>
          </FormField>
          <FormField label='Trabajador Responsable'>
            <Select name='trabajador' value={form.trabajador} onChange={handleChange}>
              <option value=''>Seleccionar...</option>
              {trabajadores.map((t) => (
                <option key={t.id ?? t.id_usuario_trab} value={t.id ?? t.id_usuario_trab}>
                  {t.nombre ?? t.user_name}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input
              type='checkbox' name='estado'
              checked={form.estado} onChange={handleChange}
              className={styles.toggleInput}
            />
            <span className={styles.toggleSlider} />
            Estado: <strong>{form.estado ? 'Activa' : 'Inactiva'}</strong>
          </label>
        </div>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Actualizar Bodega' : 'Guardar Bodega'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Bodegas() {
  const [bodegas, setBodegas] = useState(mockBodegas);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editando, setEditando] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api.get('/bodegas')
      .then(({ data }) => { console.log('GET /api/bodegas →', data); setBodegas(data); })
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  const filtered = bodegas.filter(
    (b) =>
      (b.descripcion ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.ciudad ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

  const openEdit = (b) => {
    setInitialData({
      descripcion:      b.descripcion,
      ubicacion:        b.ubicacion,
      ciudad:           b.ciudad,
      capacidadMaxima:  String(b.capacidad_maxima ?? ''),
      capacidadActual:  String(b.capacidad_actual ?? ''),
      tipo:             b.tipo_bodega ?? 'Seca',
      estado:           !!b.activa,
      trabajador:       String(b.usuario_trab_id_responsable ?? ''),
    });
    setEditando(b.id_bodega);
    setMenuOpen(null);
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    const b = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/bodegas/${b.id_bodega}`);
      setBodegas((prev) => prev.filter((x) => x.id_bodega !== b.id_bodega));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'No se pudo eliminar la bodega.');
    }
  };

  const handleSave = async (form) => {
    const payload = {
      descripcion:                 form.descripcion,
      ubicacion:                   form.ubicacion,
      ciudad:                      form.ciudad,
      capacidad_maxima:            Number(form.capacidadMaxima),
      capacidad_actual:            Number(form.capacidadActual) || 0,
      tipo_bodega:                 form.tipo,
      activa:                      form.estado ? 1 : 0,
      usuario_trab_id_responsable: Number(form.trabajador) || null,
    };
    try {
      if (editando) {
        await api.put(`/bodegas/${editando}`, payload);
      } else {
        await api.post('/bodegas', payload);
      }
      const { data } = await api.get('/bodegas');
      setBodegas(data);
      closeModal();
    } catch {
      closeModal();
    }
  };

  const pct = (b) => {
    const actual = b.capacidad_actual ?? 0;
    const maxima = b.capacidad_maxima ?? 0;
    if (!maxima) return 0;
    return Math.min(100, Math.round((actual / maxima) * 100));
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por descripción o ciudad...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.btnNew} onClick={() => { setEditando(null); setInitialData(null); setShowModal(true); }}>
          + Agregar Bodega
        </button>
      </div>

      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar la bodega <strong>{confirmDelete.descripcion}</strong>? Esta acción no se puede deshacer.</span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>Confirmar</button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Descripción</th>
              <th>Ubicación</th>
              <th>Ciudad</th>
              <th>Cap. Máxima</th>
              <th>Cap. Actual</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id_bodega}>
                <td className={styles.mono}>{b.id_bodega}</td>
                <td className={styles.nombre}>{b.descripcion}</td>
                <td className={styles.small}>{b.ubicacion}</td>
                <td>{b.ciudad}</td>
                <td>{(b.capacidad_maxima ?? 0).toLocaleString()}</td>
                <td>
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div
                        className={`${styles.progressFill} ${
                          pct(b) >= 90 ? styles.pFillRed : pct(b) >= 70 ? styles.pFillYellow : styles.pFillGreen
                        }`}
                        style={{ width: `${pct(b)}%` }}
                      />
                    </div>
                    <span className={styles.pctLabel}>{(b.capacidad_actual ?? 0).toLocaleString()} ({pct(b)}%)</span>
                  </div>
                </td>
                <td>
                  <span className={styles.tipoBadge}>{b.tipo_bodega}</span>
                </td>
                <td>
                  <span className={b.activa ? styles.estadoActive : styles.estadoInactive}>
                    {b.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === b.id_bodega ? null : b.id_bodega)}
                    >⋮</button>
                    {menuOpen === b.id_bodega && (
                      <div className={styles.dropdown}>
                        <button onClick={() => openEdit(b)}>✏️ Editar</button>
                        <button
                          className={styles.dangerItem}
                          onClick={() => { setConfirmDelete(b); setMenuOpen(null); }}
                        >🗑️ Eliminar</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles.empty}>No se encontraron bodegas.</p>}
      </div>

      {showModal && (
        <BodegaModal
          onClose={closeModal}
          onSave={handleSave}
          trabajadores={trabajadores}
          initialData={initialData}
          isEdit={!!editando}
        />
      )}
    </div>
  );
}

export default Bodegas;
