import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Inventario.module.css';

const stockStatus = (item) => {
  const disp = Number(item.cantidad_disponible);
  const min  = Number(item.cantidad_minima);
  if (disp <= min * 0.5) return styles.statusCritical;
  if (disp <= min)       return styles.statusLow;
  return styles.statusOk;
};

function InventarioModal({ item, bodegas, onClose, onSave }) {
  const [form, setForm] = useState({
    cantidad_disponible: String(item.cantidad_disponible ?? 0),
    cantidad_reservada:  String(item.cantidad_reservada  ?? 0),
    cantidad_minima:     String(item.cantidad_minima     ?? 0),
    bodega_id_bodega:    String(item.bodega_id_bodega    ?? ''),
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Editar Inventario' onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Producto'>
          <Input value={item.nombre_producto ?? `Producto ${item.producto_id_producto}`} disabled />
        </FormField>

        <FormRow>
          <FormField label='Cantidad Disponible' required>
            <Input
              type='number' name='cantidad_disponible' min='0'
              value={form.cantidad_disponible} onChange={handleChange} required
            />
          </FormField>
          <FormField label='Cantidad Reservada'>
            <Input
              type='number' name='cantidad_reservada' min='0'
              value={form.cantidad_reservada} onChange={handleChange}
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Cantidad Mínima'>
            <Input
              type='number' name='cantidad_minima' min='0'
              value={form.cantidad_minima} onChange={handleChange}
            />
          </FormField>
          <FormField label='Bodega' required>
            <Select name='bodega_id_bodega' value={form.bodega_id_bodega} onChange={handleChange} required>
              <option value=''>Seleccionar bodega...</option>
              {bodegas.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.descripcion} — {b.ciudad}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Cambios</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Inventario() {
  const [items, setItems] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    api.get('/inventario')
      .then(({ data }) => setItems(data))
      .catch(() => {});

    api.get('/bodegas')
      .then(({ data }) => setBodegas(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      (item.nombre_producto ?? '').toLowerCase().includes(q) ||
      String(item.id_inventario ?? '').includes(q) ||
      (item.descripcion_bodega ?? '').toLowerCase().includes(q)
    );
  });

  const handleUpdate = async (form) => {
    try {
      await api.put(`/inventario/${editando.id_inventario}`, {
        cantidad_disponible: Number(form.cantidad_disponible),
        cantidad_reservada:  Number(form.cantidad_reservada)  || 0,
        cantidad_minima:     Number(form.cantidad_minima)     || 0,
        bodega_id_bodega:    Number(form.bodega_id_bodega),
      });
      const { data } = await api.get('/inventario');
      setItems(data);
      setEditando(null);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Error al actualizar inventario');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre, ID o bodega...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button className={styles.btnOutline}>📄 Exportar Reporte</button>
          <button className={styles.btnOutline}>📂 Cargar Excel</button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Bodega</th>
              <th>Cant. Disponible</th>
              <th>Cant. Reservada</th>
              <th>Cant. Mínima</th>
              <th>Última Actualización</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id_inventario}>
                <td className={styles.mono}>{item.id_inventario}</td>
                <td className={styles.productName}>{item.nombre_producto ?? '—'}</td>
                <td>
                  <span className={styles.bodegaBadge}>
                    {item.descripcion_bodega ?? `Bodega ${item.bodega_id_bodega}`}
                  </span>
                </td>
                <td>
                  <span className={`${styles.qty} ${stockStatus(item)}`}>
                    {item.cantidad_disponible}
                  </span>
                </td>
                <td>{item.cantidad_reservada}</td>
                <td>{item.cantidad_minima}</td>
                <td>{formatDate(item.ultima_actualizacion)}</td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === item.id_inventario ? null : item.id_inventario); }}
                    >⋮</button>
                    {menuOpen === item.id_inventario && (
                      <div className={styles.dropdown}>
                        <button onClick={() => { setEditando(item); setMenuOpen(null); }}>✏️ Editar</button>
                        <button
                          className={styles.dangerItem}
                          onClick={async () => {
                            if (!window.confirm(`¿Eliminar el producto "${item.nombre_producto ?? item.producto_id_producto}" y su registro de inventario? Esta acción no se puede deshacer.`)) return;
                            setMenuOpen(null);
                            try {
                              await api.delete(`/inventario/${item.id_inventario}`);
                              await api.delete(`/productos/${item.producto_id_producto}`);
                              setItems((prev) => prev.filter((i) => i.id_inventario !== item.id_inventario));
                            } catch (error) {
                              console.error(error);
                              alert(error.response?.data?.message || 'Error al eliminar el producto o su inventario');
                            }
                          }}
                        >🗑️ Eliminar</button>
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

      {editando && (
        <InventarioModal
          item={editando}
          bodegas={bodegas}
          onClose={() => setEditando(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}

export default Inventario;
