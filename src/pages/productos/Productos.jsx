import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Productos.module.css';

const emptyForm = {
  nombre_producto: '',
  valor_neto: '',
  valor_de_venta: '',
  lote: '',
  fecha_vencimiento: '',
  bodega_id_bodega: '',
};

function ProductoModal({ onClose, onSave, bodegas }) {
  const [form, setForm] = useState(emptyForm);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Agregar Producto' onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Nombre del Producto' required>
          <Input
            name='nombre_producto'
            value={form.nombre_producto}
            onChange={handleChange}
            placeholder='Ej: Leche Entera 1L'
            required
          />
        </FormField>

        <FormRow>
          <FormField label='Valor Neto' required>
            <Input
              type='number'
              name='valor_neto'
              value={form.valor_neto}
              onChange={handleChange}
              placeholder='0'
              min='0'
              required
            />
          </FormField>
          <FormField label='Valor de Venta' required>
            <Input
              type='number'
              name='valor_de_venta'
              value={form.valor_de_venta}
              onChange={handleChange}
              placeholder='0'
              min='0'
              required
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Lote'>
            <Input
              name='lote'
              value={form.lote}
              onChange={handleChange}
              placeholder='Ej: LOTE-2026-001'
            />
          </FormField>
          <FormField label='Fecha de Vencimiento'>
            <Input
              type='date'
              name='fecha_vencimiento'
              value={form.fecha_vencimiento}
              onChange={handleChange}
            />
          </FormField>
        </FormRow>

        <FormField label='Bodega' required>
          <Select
            name='bodega_id_bodega'
            value={form.bodega_id_bodega}
            onChange={handleChange}
            required
          >
            <option value=''>Seleccionar bodega...</option>
            {bodegas.map((b) => (
              <option key={b.id_bodega} value={b.id_bodega}>
                {b.descripcion} — {b.ciudad}
              </option>
            ))}
          </Select>
        </FormField>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Producto</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Productos() {
  const [productos, setProductos] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    api.get('/productos')
      .then(({ data }) => setProductos(data))
      .catch(() => {});

    api.get('/bodegas')
      .then(({ data }) => setBodegas(data))
      .catch(() => {});
  }, []);

  const filtered = productos.filter((p) =>
    (p.nombre_producto ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.lote ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    try {
      await api.post('/productos', {
        nombre_producto:  form.nombre_producto,
        valor_neto:       Number(form.valor_neto),
        valor_de_venta:      Number(form.valor_de_venta),
        lote:             form.lote || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        bodega_id_bodega: Number(form.bodega_id_bodega),
      });
      const { data } = await api.get('/productos');
      setProductos(data);
    } catch {
      setProductos((prev) => [
        {
          id_producto: Date.now(),
          nombre_producto: form.nombre_producto,
          valor_neto: Number(form.valor_neto),
          valor_de_venta: Number(form.valor_de_venta),
          lote: form.lote || null,
          fecha_vencimiento: form.fecha_vencimiento || null,
          bodega_id_bodega: Number(form.bodega_id_bodega),
        },
        ...prev,
      ]);
    }
    setShowModal(false);
  };

  const handleDelete = (id) => {
    api.delete(`/productos/${id}`).catch(() => {});
    setProductos((prev) => prev.filter((p) => p.id_producto !== id));
    setMenuOpen(null);
  };

  const bodegaLabel = (id) => {
    const b = bodegas.find((b) => b.id_bodega === id);
    return b ? b.descripcion : `Bodega ${id}`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Productos</h2>
        <p className={styles.pageSubtitle}>Gestión de productos</p>
      </div>

      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre o lote...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Producto
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID Producto</th>
              <th>Nombre</th>
              <th>Valor Neto</th>
              <th>Valor de Venta</th>
              <th>Lote</th>
              <th>Fecha Vencimiento</th>
              <th>Bodega</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id_producto}>
                <td className={styles.mono}>{p.id_producto}</td>
                <td className={styles.productName}>{p.nombre_producto}</td>
                <td>
                  <span className={styles.priceBadge}>{formatCOP(p.valor_neto)}</span>
                </td>
                <td>
                  <span className={styles.priceBadge}>{formatCOP(p.valor_de_venta)}</span>
                </td>
                <td>
                  {p.lote ? (
                    <span className={styles.loteBadge}>{p.lote}</span>
                  ) : '-'}
                </td>
                <td>{formatDate(p.fecha_vencimiento)}</td>
                <td>
                  <span className={styles.bodegaBadge}>{bodegaLabel(p.bodega_id_bodega)}</span>
                </td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === p.id_producto ? null : p.id_producto)}
                    >
                      ⋮
                    </button>
                    {menuOpen === p.id_producto && (
                      <div className={styles.dropdown}>
                        <button onClick={() => setMenuOpen(null)}>✏️ Editar</button>
                        <button
                          className={styles.dangerItem}
                          onClick={() => handleDelete(p.id_producto)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className={styles.empty}>No se encontraron productos.</p>
        )}
      </div>

      {showModal && (
        <ProductoModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          bodegas={bodegas}
        />
      )}
    </div>
  );
}

export default Productos;
