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

function ProveedorModal({ onClose, onSave, trabajadores, inventario }) {
  const [form, setForm] = useState(emptyForm);
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
    <Modal title='Agregar Proveedor' onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                <option key={p.id} value={p.nombre}>{p.nombre}</option>
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
          <BtnPrimary type='submit'>Guardar Proveedor</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Proveedores() {
  const [proveedores, setProveedores] = useState(mockProveedores);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [inventario, setInventario] = useState(mockInventario);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    api.get('/proveedores')
      .then(({ data }) => setProveedores(data))
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});

    api.get('/inventario')
      .then(({ data }) => setInventario(data))
      .catch(() => {});
  }, []);

  const filtered = proveedores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.nit.includes(search)
  );

  const handleSave = async (form) => {
    try {
      await api.post('/proveedores', {
        nombre_proveedor: form.nombre,
        NIT:              form.nit,
        id_usuario_trab:  Number(form.trabajador) || null,
      });
      const { data } = await api.get('/proveedores');
      setProveedores(data);
    } catch {
      setProveedores((prev) => [...prev, {
        id: Date.now(),
        nombre: form.nombre,
        nit: form.nit,
        pedidosPorEntregar: 0,
        fechaPedidoPendiente: null,
        idUsuario: Number(form.trabajador) || null,
      }]);
    }
    setShowModal(false);
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
              <tr key={p.id}>
                <td className={styles.mono}>{p.id}</td>
                <td className={styles.nombre}>{p.nombre}</td>
                <td className={styles.mono}>{p.nit}</td>
                <td>
                  <span className={p.pedidosPorEntregar > 0 ? styles.badgeBlue : styles.badgeGray}>
                    {p.pedidosPorEntregar}
                  </span>
                </td>
                <td>{formatDate(p.fechaPedidoPendiente)}</td>
                <td>{p.idUsuario}</td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                    >⋮</button>
                    {menuOpen === p.id && (
                      <div className={styles.dropdown}>
                        <button onClick={() => setMenuOpen(null)}>✏️ Editar</button>
                        <button className={styles.dangerItem} onClick={() => {
                          setProveedores(proveedores.filter((x) => x.id !== p.id));
                          setMenuOpen(null);
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
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          trabajadores={trabajadores}
          inventario={inventario}
        />
      )}
    </div>
  );
}

export default Proveedores;
