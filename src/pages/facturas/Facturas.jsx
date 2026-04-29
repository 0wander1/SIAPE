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
    'Pagada': styles.badgePaid,
    'Pendiente': styles.badgePending,
    'Borrador': styles.badgeDraft,
    'Vencida': styles.badgeOverdue,
  };
  return map[estado] || styles.badgeDraft;
};

function FacturaModal({ onClose, onSave, pedidos, trabajadores, nextNum }) {
  const [form, setForm] = useState({
    numeroFactura: `F-2026-${String(nextNum).padStart(3, '0')}`,
    idPedido: '',
    fechaEmision: '',
    fechaVencimiento: '',
    subtotal: '',
    impuesto: 19,
    descuento: 0,
    estado: 'Borrador',
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

  return (
    <Modal title='Generar Nueva Factura' onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormRow>
          <FormField label='Número de Factura' required>
            <Input name='numeroFactura' value={form.numeroFactura}
              onChange={handleChange} placeholder='F-2026-001' required />
          </FormField>
          <FormField label='Pedido Asociado' required>
            <Select name='idPedido' value={form.idPedido} onChange={handleChange} required>
              <option value=''>Seleccionar pedido...</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>{p.id} — {p.cliente}</option>
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
              <option value='Borrador'>Borrador</option>
              <option value='Pendiente'>Pendiente</option>
              <option value='Pagada'>Pagada</option>
              <option value='Vencida'>Vencida</option>
            </Select>
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Trabajador Responsable'>
            <Select name='trabajador' value={form.trabajador} onChange={handleChange}>
              <option value=''>Seleccionar...</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </Select>
          </FormField>
          <FormField label='Total Calculado'>
            <Input value={formatCOP(total)} disabled />
          </FormField>
        </FormRow>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Generar Factura</BtnPrimary>
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

  const filtered = facturas.filter((f) => {
    const matchSearch = f.numeroFactura.toLowerCase().includes(search.toLowerCase()) ||
      f.idPedido.toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || f.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const handleSave = (form) => {
    setFacturas([...facturas, {
      id: facturas.length + 1,
      numeroFactura: form.numeroFactura,
      fechaEmision: form.fechaEmision,
      fechaVencimiento: form.fechaVencimiento,
      subtotal: Number(form.subtotal),
      impuesto: form.impuesto,
      descuento: Number(form.descuento) || 0,
      total: form.total,
      estado: form.estado,
      idPedido: form.idPedido,
    }]);
    setShowModal(false);
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
          <option value='Borrador'>Borrador</option>
          <option value='Pendiente'>Pendiente</option>
          <option value='Pagada'>Pagada</option>
          <option value='Vencida'>Vencida</option>
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id}>
                <td className={styles.mono}>{f.id}</td>
                <td className={styles.factNum}>{f.numeroFactura}</td>
                <td>{formatDate(f.fechaEmision)}</td>
                <td>{formatDate(f.fechaVencimiento)}</td>
                <td>{formatCOP(f.subtotal)}</td>
                <td>{formatCOP(f.impuesto)}</td>
                <td>{formatCOP(f.descuento)}</td>
                <td className={styles.total}>{formatCOP(f.total)}</td>
                <td>
                  <span className={`${styles.badge} ${estadoClass(f.estado)}`}>
                    {f.estado}
                  </span>
                </td>
                <td className={styles.mono}>{f.idPedido}</td>
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
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          pedidos={pedidos}
          trabajadores={trabajadores}
          nextNum={facturas.length + 1}
        />
      )}
    </div>
  );
}

export default Facturas;
