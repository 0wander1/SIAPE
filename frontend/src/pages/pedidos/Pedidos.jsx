import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, Textarea, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pedidos.module.css';

const estadoClass = (estado) => {
  const map = {
    pendiente:   styles.badgePending,
    confirmado:  styles.badgeConfirmed,
    en_transito: styles.badgeTransit,
    recibido:    styles.badgeDelivered,
    cancelado:   styles.badgeCancelled,
  };
  return map[estado] || styles.badgePending;
};

const ESTADOS = [
  { value: 'pendiente',   label: 'Pendiente' },
  { value: 'confirmado',  label: 'Confirmado' },
  { value: 'en_transito', label: 'En Tránsito' },
  { value: 'recibido',    label: 'Recibido' },
  { value: 'cancelado',   label: 'Cancelado' },
];

const emptyForm = { proveedor: '', estado: 'pendiente', fechaEstimada: '', observaciones: '' };
const emptyItem = { producto: '', cantidad: '', precioUnitario: '' };

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación de pedido a proveedor
// ─────────────────────────────────────────────────────────────────────────────
function PedidoModal({ onClose, onSave, proveedores, productos }) {
  const [form, setForm]                             = useState(emptyForm);
  const [items, setItems]                           = useState([]);
  const [itemForm, setItemForm]                     = useState(emptyItem);
  const [productosProveedor, setProductosProveedor] = useState([]);
  const [errorMsg, setErrorMsg]                     = useState('');

  // Cuando el proveedor cambia, obtiene sus productos_asociados y los cruza con
  // la lista completa de productos para recuperar nombre y demás campos.
  // Si se limpia el selector, vacía la lista para que el dropdown quede vacío.
  useEffect(() => {
    if (!form.proveedor) {
      setProductosProveedor([]);
      return;
    }
    api.get(`/proveedores/${form.proveedor}`)
      .then(({ data }) => {
        const asociados = (data.productos_asociados ?? [])
          .map((pa) => productos.find((p) => p.id_producto === pa.producto_id_producto))
          .filter(Boolean);
        setProductosProveedor(asociados);
      })
      .catch(() => setProductosProveedor([]));
  }, [form.proveedor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Al cambiar el proveedor los productos disponibles cambian, así que se
    // limpia el selector de producto del ítem para evitar un valor huérfano.
    if (name === 'proveedor') setItemForm(emptyItem);
    setForm({ ...form, [name]: value });
  };

  const addItem = () => {
    if (!itemForm.producto || !itemForm.cantidad) return;
    const prod = productosProveedor.find((p) => String(p.id_producto) === itemForm.producto);
    setItems([...items, {
      producto_id_producto: Number(itemForm.producto),
      nombre_producto:      prod?.nombre_producto ?? '',
      cantidad:             Number(itemForm.cantidad),
      precio_unitario:      Number(itemForm.precioUnitario) || 0,
    }]);
    setItemForm(emptyItem);
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  // El valor total se recalcula en cada render a partir de los items acumulados.
  const valorTotal = items.reduce((sum, i) => sum + i.cantidad * i.precio_unitario, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave({
        proveedor_id_proveedor: Number(form.proveedor),
        estado:                 form.estado,
        fecha_estimada:         form.fechaEstimada || null,
        observaciones:          form.observaciones || null,
        valor_total:            valorTotal,
        items:                  items.map(({ producto_id_producto, cantidad, precio_unitario }) => ({
          producto_id_producto, cantidad, precio_unitario,
        })),
      });
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al crear el pedido.';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  return (
    <Modal title='Nuevo Pedido a Proveedor' onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {errorMsg && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
            borderRadius: 8, padding: '10px 16px', fontSize: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <span>{errorMsg}</span>
            <button
              type='button'
              onClick={() => setErrorMsg('')}
              style={{ background: 'none', color: '#dc2626', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
            >✕</button>
          </div>
        )}

        <FormRow>
          <FormField label='Proveedor' required>
            <Select name='proveedor' value={form.proveedor} onChange={handleChange} required>
              <option value=''>Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_proveedor}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label='Estado'>
            <Select name='estado' value={form.estado} onChange={handleChange}>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Fecha Estimada de Entrega'>
            <Input type='date' name='fechaEstimada' value={form.fechaEstimada} onChange={handleChange} />
          </FormField>
          <FormField label='Valor Total'>
            <Input value={formatCOP(valorTotal)} disabled />
          </FormField>
        </FormRow>

        <FormField label='Observaciones'>
          <Textarea
            name='observaciones' value={form.observaciones} onChange={handleChange}
            placeholder='Instrucciones adicionales...'
          />
        </FormField>

        {/* ── Sección de ítems ──────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Productos del Pedido
          </p>
          <FormRow>
            <FormField label='Producto'>
              <Select
                value={itemForm.producto}
                onChange={(e) => setItemForm({ ...itemForm, producto: e.target.value })}
              >
                <option value=''>
                  {form.proveedor ? 'Seleccionar...' : 'Selecciona un proveedor primero'}
                </option>
                {productosProveedor.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.nombre_producto}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label='Cantidad'>
              <Input
                type='number' min='1' placeholder='0'
                value={itemForm.cantidad}
                onChange={(e) => setItemForm({ ...itemForm, cantidad: e.target.value })}
              />
            </FormField>
            <FormField label='Precio Unitario'>
              <Input
                type='number' min='0' placeholder='0'
                value={itemForm.precioUnitario}
                onChange={(e) => setItemForm({ ...itemForm, precioUnitario: e.target.value })}
              />
            </FormField>
          </FormRow>

          <button
            type='button'
            className={styles.btnNew}
            style={{ fontSize: 13, padding: '6px 14px', marginTop: 4 }}
            onClick={addItem}
          >
            + Agregar Ítem
          </button>

          {items.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 6, padding: '6px 12px', fontSize: 13,
                  }}
                >
                  <span style={{ flex: 1 }}>{item.nombre_producto}</span>
                  <span style={{ color: '#6b7280', marginRight: 16 }}>
                    x{item.cantidad} — {formatCOP(item.precio_unitario)}
                  </span>
                  <button
                    type='button'
                    onClick={() => removeItem(idx)}
                    style={{ color: '#dc2626', fontWeight: 700, fontSize: 14, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Crear Pedido</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de detalle de pedido a proveedor
// ─────────────────────────────────────────────────────────────────────────────
function DetallePedidoModal({ pedido, onClose }) {
  const items = pedido.items ?? [];

  return (
    <Modal title='Detalle del Pedido' onClose={onClose} size='lg'>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Encabezado: ID + badge de estado ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#6b7280' }}>
            #{pedido.id_pedido_prov}
          </span>
          <span className={`${styles.badge} ${estadoClass(pedido.estado)}`}>
            {pedido.estado}
          </span>
        </div>

        {/* ── Info general ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px',
          background: '#f8fafc', borderRadius: 8, padding: '14px 16px',
          border: '1px solid #f1f5f9',
        }}>
          {[
            ['Proveedor',       pedido.nombre_proveedor ?? '-'],
            ['Trabajador',      pedido.trabajador        ?? '-'],
            ['Fecha Estimada',  formatDate(pedido.fechaEstimada)],
            ['Fecha Creación',  formatDate(pedido.fecha_creacion)],
            ['Valor Total',     formatCOP(pedido.valorTotal)],
            ['Observaciones',   pedido.observaciones     || '-'],
          ].map(([label, value]) => (
            <div key={label}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                {label}
              </p>
              <p style={{ fontSize: 13, color: '#374151' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabla de productos ── */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
            Productos
          </p>
          {items.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Sin productos registrados.</p>
          ) : (
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Producto', 'Cantidad', 'Precio Unitario', 'Subtotal'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{item.nombre_producto ?? '-'}</td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{item.cantidad}</td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{formatCOP(item.precio_unitario)}</td>
                      <td style={{ padding: '9px 12px', color: '#374151', fontWeight: 500 }}>{formatCOP(item.cantidad * item.precio_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Botón Cerrar ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BtnSecondary type='button' onClick={onClose}>Cerrar</BtnSecondary>
        </div>

      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de edición de pedido a proveedor
// ─────────────────────────────────────────────────────────────────────────────
function EditarPedidoModal({ pedido, onClose, onSave }) {
  const [form, setForm] = useState({
    estado:        pedido.estado ?? 'pendiente',
    fechaEstimada: pedido.fechaEstimada?.slice(0, 10) ?? '',
    observaciones: pedido.observaciones ?? '',
    bodega_id:     '',
  });
  const [bodegas, setBodegas] = useState([]);

  useEffect(() => {
    api.get('/bodegas').then(({ data }) => setBodegas(data)).catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title={`Editar Pedido #${pedido.id_pedido_prov}`} onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <FormField label='Estado'>
          <Select name='estado' value={form.estado} onChange={handleChange}>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </Select>
        </FormField>

        {form.estado === 'recibido' && (
          <>
            <div style={{
              background: '#fffbeb', border: '1px solid #fcd34d',
              color: '#92400e', borderRadius: 6, padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
            }}>
              ⚠️ Al guardar este cambio, las cantidades de los productos se agregarán automáticamente al inventario. Esta acción no se puede deshacer.
            </div>

            <FormField label='Bodega de destino' required>
              <Select name='bodega_id' value={form.bodega_id} onChange={handleChange} required>
                <option value=''>Seleccionar bodega...</option>
                {bodegas.map((b) => (
                  <option key={b.id_bodega} value={b.id_bodega}>{b.descripcion}</option>
                ))}
              </Select>
            </FormField>
          </>
        )}

        <FormField label='Fecha Estimada de Entrega'>
          <Input type='date' name='fechaEstimada' value={form.fechaEstimada} onChange={handleChange} />
        </FormField>

        <FormField label='Observaciones'>
          <Textarea
            name='observaciones' value={form.observaciones} onChange={handleChange}
            placeholder='Instrucciones adicionales...'
          />
        </FormField>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Cambios</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Pedidos() {
  const { isAdmin } = useRole();

  const [pedidos, setPedidos]             = useState([]);
  const [proveedores, setProveedores]     = useState([]);
  const [productos, setProductos]         = useState([]);
  const [showModal, setShowModal]         = useState(false);
  const [editando, setEditando]           = useState(null);
  const [verDetalle, setVerDetalle]       = useState(null);
  const [menuOpen, setMenuOpen]           = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [errorMsg, setErrorMsg]           = useState('');

  useEffect(() => {
    api.get('/pedidos-proveedor').then(({ data }) => setPedidos(data)).catch(() => {});
    api.get('/proveedores').then(({ data }) => setProveedores(data)).catch(() => {});
    api.get('/productos').then(({ data }) => setProductos(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const close = () => setMenuOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const handleConfirmDelete = async () => {
    const p = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/pedidos-proveedor/${p.id_pedido_prov}`);
      setPedidos((prev) => prev.filter((x) => x.id_pedido_prov !== p.id_pedido_prov));
    } catch (error) {
      showError(error.response?.data?.message || 'Error al eliminar el pedido.');
    }
  };

  const handleUpdate = async (form) => {
    try {
      await api.put(`/pedidos-proveedor/${editando.id_pedido_prov}`, {
        estado:         form.estado,
        fecha_estimada: form.fechaEstimada || null,
        observaciones:  form.observaciones || null,
        ...(form.estado === 'recibido' ? { bodega_id: form.bodega_id } : {}),
      });
      const { data } = await api.get('/pedidos-proveedor');
      setPedidos(data);
      setEditando(null);
    } catch (error) {
      showError(error.response?.data?.message || 'Error al actualizar el pedido.');
    }
  };

  const handleSave = async (payload) => {
    const user = JSON.parse(localStorage.getItem('siape_user') || 'null');
    await api.post('/pedidos-proveedor', { ...payload, usuario_trab_id: user?.id });
    const { data } = await api.get('/pedidos-proveedor');
    setPedidos(data);
    setShowModal(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>Pedidos a Proveedores</h2>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Nuevo Pedido
        </button>
      </div>

      {errorMsg && (
        <div className={styles.errorBanner}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className={styles.errorBannerClose}>✕</button>
        </div>
      )}

      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>
            ¿Eliminar el pedido <strong>#{confirmDelete.id_pedido_prov}</strong>? Esta acción no se puede deshacer.
          </span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>
              Cancelar
            </button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>
              Confirmar
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Proveedor</th>
              <th>Trabajador</th>
              <th>Estado</th>
              <th>Valor Total</th>
              <th>Fecha Estimada</th>
              <th>Observaciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id_pedido_prov}>
                <td className={styles.mono}>{p.id_pedido_prov}</td>
                <td>{p.nombre_proveedor ?? '-'}</td>
                <td>{p.trabajador ?? '-'}</td>
                <td>
                  <span className={`${styles.badge} ${estadoClass(p.estado)}`}>
                    {p.estado}
                  </span>
                </td>
                <td>{formatCOP(p.valorTotal)}</td>
                <td>{formatDate(p.fechaEstimada)}</td>
                <td className={styles.obs}>{p.observaciones || '-'}</td>
                <td className={styles.menuCell}>
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(menuOpen === p.id_pedido_prov ? null : p.id_pedido_prov);
                        }}
                      >⋮</button>
                      {menuOpen === p.id_pedido_prov && (
                        <div className={styles.dropdown}>
                          <button onClick={() => { setVerDetalle(p); setMenuOpen(null); }}>
                            👁️ Ver Detalles
                          </button>
                          <button onClick={() => { setEditando(p); setMenuOpen(null); }}>
                            ✏️ Editar
                          </button>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(p); setMenuOpen(null); }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pedidos.length === 0 && (
          <p style={{ padding: '20px 16px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
            No hay pedidos a proveedores registrados.
          </p>
        )}
      </div>

      {showModal && (
        <PedidoModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          proveedores={proveedores}
          productos={productos}
        />
      )}

      {verDetalle && (
        <DetallePedidoModal
          pedido={verDetalle}
          onClose={() => setVerDetalle(null)}
        />
      )}

      {editando && (
        <EditarPedidoModal
          pedido={editando}
          onClose={() => setEditando(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}

export default Pedidos;
