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

function BodegaModal({ onClose, onSave, trabajadores }) {
  const [form, setForm] = useState(emptyForm);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Agregar Bodega' onClose={onClose} size='lg'>
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
          <BtnPrimary type='submit'>Guardar Bodega</BtnPrimary>
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

  useEffect(() => {
    api.get('/bodegas')
      .then(({ data }) => setBodegas(data))
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  const filtered = bodegas.filter(
    (b) =>
      b.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      b.ciudad.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    try {
      await api.post('/bodegas', {
        descripcion:                form.descripcion,
        ubicacion:                  form.ubicacion,
        ciudad:                     form.ciudad,
        capacidad_maxima:           Number(form.capacidadMaxima),
        capacidad_actual:           Number(form.capacidadActual) || 0,
        tipo_bodega:                form.tipo,
        activa:                     form.estado ? 1 : 0,
        usuario_trab_id_responsable: Number(form.trabajador) || null,
      });
      const { data } = await api.get('/bodegas');
      setBodegas(data);
    } catch {
      setBodegas((prev) => [...prev, {
        id: Date.now(),
        descripcion: form.descripcion,
        ubicacion: form.ubicacion,
        ciudad: form.ciudad,
        capacidadMaxima: Number(form.capacidadMaxima),
        capacidadActual: Number(form.capacidadActual) || 0,
        tipo: form.tipo,
        estado: form.estado ? 'Activa' : 'Inactiva',
      }]);
    }
    setShowModal(false);
  };

  const pct = (b) => Math.round((b.capacidadActual / b.capacidadMaxima) * 100);

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
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Bodega
        </button>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td className={styles.mono}>{b.id}</td>
                <td className={styles.nombre}>{b.descripcion}</td>
                <td className={styles.small}>{b.ubicacion}</td>
                <td>{b.ciudad}</td>
                <td>{b.capacidadMaxima.toLocaleString()}</td>
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
                    <span className={styles.pctLabel}>{b.capacidadActual} ({pct(b)}%)</span>
                  </div>
                </td>
                <td>
                  <span className={styles.tipoBadge}>{b.tipo}</span>
                </td>
                <td>
                  <span className={b.estado === 'Activa' ? styles.estadoActive : styles.estadoInactive}>
                    {b.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles.empty}>No se encontraron bodegas.</p>}
      </div>

      {showModal && (
        <BodegaModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          trabajadores={trabajadores}
        />
      )}
    </div>
  );
}

export default Bodegas;
