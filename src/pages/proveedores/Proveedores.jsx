import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockProveedores, mockTrabajadores, mockInventario } from '../../utils/mockData.js';
import { formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Proveedores.module.css';

const emptyForm = {
  nombre: '', nit: '', trabajador: '', productos: [],
};

function ProveedorModal({ onClose, onSave, trabajadores, inventario, nitError, initialData, isEdit }) {
  const [form, setForm] = useState(initialData ?? emptyForm);
  const [productoSel, setProductoSel] = useState('');

  const addProducto = () => {
    if (!productoSel || form.productos.includes(productoSel)) return;
    setForm({ ...form, productos: [...form.productos, productoSel] });
    setProductoSel('');
  };

  const removeProducto = (p) => {
    setForm({ ...form, productos: form.productos.filter((x) => x !== p) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'Editar Proveedor' : 'Agregar Proveedor'} onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {nitError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 14 }}>
            {nitError}
          </div>
        )}
        <FormField label='Nombre del Proveedor' required>
          <Input
            name='nombre' value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder='Razón social' required
          />
        </FormField>

        <FormRow>
          <FormField label='NIT' required>
            <Input
              name='nit' value={form.nit}
              onChange={(e) => setForm({ ...form, nit: e.target.value })}
              placeholder='900000000-0' required
            />
          </FormField>
          <FormField label='Trabajador Responsable'>
            <Select
              value={form.trabajador}
              onChange={(e) => setForm({ ...form, trabajador: e.target.value })}
            >
              <option value=''>Seleccionar...</option>
              {trabajadores.map((t) => (
                <option key={t.id ?? t.id_usuario_trab} value={t.id ?? t.id_usuario_trab}>
                  {t.nombre ?? t.user_name}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <div className={styles.productosSection}>
          <p className={styles.sectionLabel}>Productos Asociados</p>
          <div className={styles.addProductRow}>
            <Select
              value={productoSel}
              onChange={(e) => setProductoSel(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value=''>Seleccionar producto...</option>
              {inventario.map((p) => (
                <option key={p.id_producto ?? p.id} value={p.nombre_producto ?? p.nombre}>
                  {p.nombre_producto ?? p.nombre}
                </option>
              ))}
            </Select>
            <button type='button' className={styles.btnAddProd} onClick={addProducto}>
              + Agregar Producto
            </button>
          </div>
          {form.productos.length > 0 && (
            <div className={styles.productosList}>
              {form.productos.map((p) => (
                <span key={p} className={styles.productoTag}>
                  {p}
                  <button type='button' onClick={() => removeProducto(p)}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Actualizar Proveedor' : 'Guardar Proveedor'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [inventario, setInventario] = useState(mockInventario);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [nitError, setNitError] = useState('');
  const [editando, setEditando] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    api.get('/proveedores')
      .then(({ data }) => { console.log('[Proveedores] GET /proveedores:', data); setProveedores(data); })
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});

    api.get('/productos')
      .then(({ data }) => setInventario(data))
      .catch(() => {});
  }, []);

  const filtered = proveedores.filter(
    (p) =>
      (p.nombre_proveedor ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.NIT ?? '').includes(search)
  );

  const openEdit = (p) => {
    setInitialData({
      nombre:    p.nombre_proveedor,
      nit:       p.NIT,
      trabajador: String(p.id_usuario_trab ?? ''),
      productos: (p.productos_asociados ?? []).map((pa) => {
        const prod = inventario.find((i) => (i.id_producto ?? i.id) == pa.producto_id_producto);
        return prod ? (prod.nombre_producto ?? prod.nombre) : String(pa.producto_id_producto);
      }),
    });
    setEditando(p.id_proveedor);
    setNitError('');
    setMenuOpen(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
    setNitError('');
  };

  const handleSave = async (form) => {
    setNitError('');
    try {
      if (editando) {
        await api.put(`/proveedores/${editando}`, {
          nombre_proveedor: form.nombre,
          NIT:              form.nit,
          id_usuario_trab:  Number(form.trabajador) || null,
        });
      } else {
        await api.post('/proveedores', {
          nombre_proveedor: form.nombre,
          NIT:              form.nit,
          id_usuario_trab:  Number(form.trabajador) || null,
        });
      }
      const { data } = await api.get('/proveedores');
      setProveedores(data);
      closeModal();
    } catch (error) {
      if (error.response?.status === 409) {
        setNitError('Ya existe un proveedor con ese NIT.');
      } else {
        closeModal();
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre o NIT...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Proveedor
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>NIT</th>
              <th>Pedidos por Entregar</th>
              <th>Fecha Pedido Pendiente</th>
              <th>ID Usuario</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id_proveedor}>
                <td className={styles.mono}>{p.id_proveedor}</td>
                <td className={styles.nombre}>{p.nombre_proveedor}</td>
                <td className={styles.mono}>{p.NIT}</td>
                <td>
                  <span className={(p.productos_asociados?.length ?? 0) > 0 ? styles.badgeBlue : styles.badgeGray}>
                    {p.productos_asociados?.length ?? 0}
                  </span>
                </td>
                <td>-</td>
                <td>{p.id_usuario_trab ?? '-'}</td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === p.id_proveedor ? null : p.id_proveedor)}
                    >⋮</button>
                    {menuOpen === p.id_proveedor && (
                      <div className={styles.dropdown}>
                        <button onClick={() => openEdit(p)}>✏️ Editar</button>
                        <button className={styles.dangerItem} onClick={async () => {
                          if (!window.confirm(`¿Eliminar el proveedor "${p.nombre_proveedor}"? Esta acción no se puede deshacer.`)) return;
                          setMenuOpen(null);
                          try {
                            await api.delete(`/proveedores/${p.id_proveedor}`);
                            setProveedores((prev) => prev.filter((x) => x.id_proveedor !== p.id_proveedor));
                          } catch {
                            window.alert('No se pudo eliminar el proveedor. Intenta de nuevo.');
                          }
                        }}>🗑️ Eliminar</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className={styles.empty}>No se encontraron proveedores.</p>
        )}
      </div>

      {showModal && (
        <ProveedorModal
          onClose={closeModal}
          onSave={handleSave}
          trabajadores={trabajadores}
          inventario={inventario}
          nitError={nitError}
          initialData={initialData}
          isEdit={!!editando}
        />
      )}
    </div>
  );
}

export default Proveedores;
