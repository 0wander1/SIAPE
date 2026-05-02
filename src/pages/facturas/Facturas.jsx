import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockFacturas, mockPedidos, mockTrabajadores } from '../../utils/mockData.js';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Facturas.module.css';

const estadoClass = (estado) => {
  const map = {
    'emitida':  styles.badgePending,
    'pagada':   styles.badgePaid,
    'vencida':  styles.badgeOverdue,
    'anulada':  styles.badgeDraft,
    'parcial':  styles.badgeDraft,
  };
  return map[estado] || styles.badgeDraft;
};

function FacturaModal({ onClose, onSave, pedidos, trabajadores, nextNum, initialData, pedidoError }) {
  const [form, setForm] = useState(initialData ?? {
    numeroFactura: `F-2026-${String(nextNum).padStart(3, '0')}`,
    idPedido: '',
    fechaEmision: '',
    fechaVencimiento: '',
    subtotal: '',
    impuesto: 19,
    descuento: 0,
    estado: 'emitida',
    trabajador: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const subtotal = Number(form.subtotal) || 0;
  const impuestoAmt = Math.round(subtotal * (Number(form.impuesto) / 100));
  const total = subtotal + impuestoAmt - Number(form.descuento || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, impuesto: impuestoAmt, total });
  };

  const isEdit = !!initialData;

  return (
    <Modal title={isEdit ? 'Editar Factura' : 'Generar Nueva Factura'} onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pedidoError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 14 }}>
            {pedidoError}
          </div>
        )}
        <FormRow>
          <FormField label='Número de Factura' required>
            <Input name='numeroFactura' value={form.numeroFactura}
              onChange={handleChange} placeholder='F-2026-001' required />
          </FormField>
          <FormField label='Pedido Asociado' required>
            <Select name='idPedido' value={form.idPedido} onChange={handleChange} required>
              <option value=''>Seleccionar pedido...</option>
              {pedidos.map((p) => (
                <option key={p.id_pedido ?? p.id} value={p.id_pedido ?? p.id}>
                  {p.id_pedido ?? p.id} — {p.cliente ?? p.nombre_cliente}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Fecha de Emisión' required>
            <Input type='date' name='fechaEmision' value={form.fechaEmision}
              onChange={handleChange} required />
          </FormField>
          <FormField label='Fecha de Vencimiento' required>
            <Input type='date' name='fechaVencimiento' value={form.fechaVencimiento}
              onChange={handleChange} required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Subtotal (COP)' required>
            <Input type='number' name='subtotal' min='0' value={form.subtotal}
              onChange={handleChange} placeholder='0' required />
          </FormField>
          <FormField label='Impuesto (%)'>
            <Input type='number' name='impuesto' min='0' max='100'
              value={form.impuesto} onChange={handleChange} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Descuento (COP)'>
            <Input type='number' name='descuento' min='0'
              value={form.descuento} onChange={handleChange} />
          </FormField>
          <FormField label='Estado'>
            <Select name='estado' value={form.estado} onChange={handleChange}>
              <option value='emitida'>Emitida</option>
              <option value='pagada'>Pagada</option>
              <option value='vencida'>Vencida</option>
              <option value='anulada'>Anulada</option>
              <option value='parcial'>Parcial</option>
            </Select>
          </FormField>
        </FormRow>

        <FormRow>
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
          <FormField label='Total Calculado'>
            <Input value={formatCOP(total)} disabled />
          </FormField>
        </FormRow>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Guardar Cambios' : 'Generar Factura'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Facturas() {
  const [facturas, setFacturas] = useState(mockFacturas);
  const [pedidos, setPedidos] = useState(mockPedidos);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editando, setEditando] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [pedidoError, setPedidoError] = useState('');

  useEffect(() => {
    api.get('/facturas')
      .then(({ data }) => setFacturas(data))
      .catch(() => {});

    api.get('/pedidos')
      .then(({ data }) => setPedidos(data))
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
    setPedidoError('');
  };

  const openEdit = (f) => {
    const sub = Number(f.subtotal) || 0;
    const imp = Number(f.impuesto) || 0;
    setInitialData({
      numeroFactura:    f.numero_factura,
      idPedido:         String(f.pedido_id_pedido ?? ''),
      fechaEmision:     f.fecha_emision?.slice(0, 10) ?? '',
      fechaVencimiento: f.fecha_vencimiento?.slice(0, 10) ?? '',
      subtotal:         String(sub),
      impuesto:         sub > 0 ? Math.round((imp / sub) * 100) : 0,
      descuento:        String(Number(f.descuento) || 0),
      estado:           f.estado ?? 'emitida',
      trabajador:       String(f.usuario_trab_id ?? ''),
    });
    setEditando(f.id_factura);
    setMenuOpen(null);
    setPedidoError('');
    setShowModal(true);
  };

  const filtered = facturas.filter((f) => {
    const matchSearch = (f.numero_factura ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(f.pedido_id_pedido ?? '').toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || f.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const handleSave = async (form) => {
    const storedUser = JSON.parse(localStorage.getItem('siape_user') || 'null');
    const usuarioTrabId = storedUser?.id || null;
    const payload = {
      numero_factura:    form.numeroFactura,
      fecha_emision:     form.fechaEmision,
      fecha_vencimiento: form.fechaVencimiento || null,
      subtotal:          Number(form.subtotal),
      impuesto:          form.impuesto,
      descuento:         Number(form.descuento) || 0,
      estado:            form.estado,
      usuario_trab_id:   usuarioTrabId,
      pedido_id_pedido:  form.idPedido,
    };
    setPedidoError('');
    try {
      if (editando) {
        await api.put(`/facturas/${editando}`, payload);
      } else {
        await api.post('/facturas', payload);
      }
      const { data } = await api.get('/facturas');
      setFacturas(data);
      closeModal();
    } catch (error) {
      console.error(error);
      if (error.response?.status === 409) {
        setPedidoError(error.response.data?.message || 'Ya existe una factura para ese pedido.');
      } else {
        alert(error.response?.data?.message || `Error al ${editando ? 'editar' : 'crear'} factura`);
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
            placeholder='Buscar por número o pedido...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value=''>Todos los estados</option>
          <option value='emitida'>Emitida</option>
          <option value='pagada'>Pagada</option>
          <option value='vencida'>Vencida</option>
          <option value='anulada'>Anulada</option>
          <option value='parcial'>Parcial</option>
        </select>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Generar Nueva Factura
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Número Factura</th>
              <th>F. Emisión</th>
              <th>F. Vencimiento</th>
              <th>Subtotal</th>
              <th>Impuesto</th>
              <th>Descuento</th>
              <th>Total</th>
              <th>Estado</th>
              <th>ID Pedido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id_factura}>
                <td className={styles.mono}>{f.id_factura}</td>
                <td className={styles.factNum}>{f.numero_factura}</td>
                <td>{formatDate(f.fecha_emision)}</td>
                <td>{formatDate(f.fecha_vencimiento)}</td>
                <td>{formatCOP(f.subtotal)}</td>
                <td>{formatCOP(f.impuesto)}</td>
                <td>{formatCOP(f.descuento)}</td>
                <td className={styles.total}>{formatCOP(f.total)}</td>
                <td>
                  <span className={`${styles.badge} ${estadoClass(f.estado)}`}>
                    {f.estado}
                  </span>
                </td>
                <td className={styles.mono}>{f.pedido_id_pedido}</td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === f.id_factura ? null : f.id_factura)}
                    >⋮</button>
                    {menuOpen === f.id_factura && (
                      <div className={styles.dropdown}>
                        <button onClick={() => openEdit(f)}>✏️ Editar</button>
                        <button
                          className={styles.dangerItem}
                          onClick={async () => {
                            if (!window.confirm(`¿Eliminar la factura "${f.numero_factura}"? Esta acción no se puede deshacer.`)) return;
                            setMenuOpen(null);
                            try {
                              await api.delete(`/facturas/${f.id_factura}`);
                              setFacturas((prev) => prev.filter((x) => x.id_factura !== f.id_factura));
                            } catch (error) {
                              console.error(error);
                              alert(error.response?.data?.message || 'Error al eliminar factura');
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
          <p className={styles.empty}>No se encontraron facturas.</p>
        )}
      </div>

      {showModal && (
        <FacturaModal
          onClose={closeModal}
          onSave={handleSave}
          pedidos={pedidos}
          trabajadores={trabajadores}
          nextNum={facturas.length + 1}
          initialData={initialData}
          pedidoError={pedidoError}
        />
      )}
    </div>
  );
}

export default Facturas;
