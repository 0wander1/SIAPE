import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockPagos, mockFacturas, mockTrabajadores } from '../../utils/mockData.js';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pagos.module.css';

const metodoBadge = (metodo) => {
  const map = {
    'Transferencia': styles.badgeTransfer,
    'Efectivo': styles.badgeCash,
    'Tarjeta': styles.badgeCard,
    'PSE': styles.badgePse,
  };
  return map[metodo] || styles.badgeTransfer;
};

const emptyForm = {
  idFactura: '', monto: '', fecha: '', metodo: 'Transferencia',
  trabajador: '', referencia: '',
};

function PagoModal({ onClose, onSave, facturas, trabajadores, pagos }) {
  const [form, setForm] = useState(emptyForm);

  // form.idFactura almacena el ID numérico de la factura
  const facturaSeleccionada = facturas.find(
    (f) => (f.id ?? f.id_factura) == form.idFactura
  );
  const montoPendiente = facturaSeleccionada
    ? (facturaSeleccionada.total ?? 0) - pagos
        .filter((p) => (p.factura_id_factura ?? p.idFactura) == form.idFactura)
        .reduce((s, p) => s + (p.monto_pagado ?? p.monto ?? 0), 0)
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Registrar Nuevo Pago' onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormRow>
          <FormField label='Factura Asociada' required>
            <Select
              value={form.idFactura}
              onChange={(e) => setForm({ ...form, idFactura: e.target.value })}
              required
            >
              <option value=''>Seleccionar factura...</option>
              {facturas.map((f) => {
                const fId  = f.id ?? f.id_factura;
                const fNum = f.numeroFactura ?? f.numero_factura;
                const fTotal = f.total ?? 0;
                return (
                  <option key={fId} value={fId}>
                    {fNum} — {formatCOP(fTotal)}
                  </option>
                );
              })}
            </Select>
          </FormField>
          <FormField label='Monto a Registrar (calculado)'>
            <Input value={facturaSeleccionada ? formatCOP(montoPendiente) : '-'} disabled />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Monto del Pago (COP)' required>
            <Input type='number' min='1' value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              placeholder='0' required />
          </FormField>
          <FormField label='Fecha del Pago' required>
            <Input type='date' value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Método de Pago'>
            <Select value={form.metodo}
              onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
              <option value='Transferencia'>Transferencia</option>
              <option value='Efectivo'>Efectivo</option>
              <option value='Tarjeta'>Tarjeta</option>
              <option value='PSE'>PSE</option>
            </Select>
          </FormField>
          <FormField label='Referencia'>
            <Input value={form.referencia}
              onChange={(e) => setForm({ ...form, referencia: e.target.value })}
              placeholder='Número de comprobante' />
          </FormField>
        </FormRow>

        <FormField label='Trabajador que Registra'>
          <Select value={form.trabajador}
            onChange={(e) => setForm({ ...form, trabajador: e.target.value })}>
            <option value=''>Seleccionar...</option>
            {trabajadores.map((t) => {
              const tId = t.id ?? t.id_usuario_trab;
              return (
                <option key={tId} value={tId}>{t.nombre ?? t.user_name}</option>
              );
            })}
          </Select>
        </FormField>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Registrar Pago</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Pagos() {
  const [pagos, setPagos] = useState(mockPagos);
  const [facturas, setFacturas] = useState(mockFacturas);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [search, setSearch] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    api.get('/pagos')
      .then(({ data }) => setPagos(data))
      .catch(() => {});

    api.get('/facturas')
      .then(({ data }) => setFacturas(data))
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  const filtered = pagos.filter((p) => {
    const matchSearch =
      p.idFactura.toLowerCase().includes(search.toLowerCase()) ||
      p.referencia.toLowerCase().includes(search.toLowerCase());
    const matchMetodo = !filtroMetodo || p.metodo === filtroMetodo;
    return matchSearch && matchMetodo;
  });

  const handleSave = async (form) => {
    try {
      await api.post('/pagos', {
        monto_pagado:               Number(form.monto),
        fecha_pago:                 form.fecha,
        metodo_pago:                form.metodo,
        referencia_transaccion:     form.referencia || null,
        factura_id_factura:         Number(form.idFactura),
        usuario_trab_id_usuario_trab: Number(form.trabajador) || null,
      });
      const { data } = await api.get('/pagos');
      setPagos(data);
    } catch {
      const trab = trabajadores.find(
        (t) => (t.id ?? t.id_usuario_trab) == form.trabajador
      );
      setPagos((prev) => [...prev, {
        id: Date.now(),
        idFactura: form.idFactura,
        monto: Number(form.monto),
        fecha: form.fecha,
        metodo: form.metodo,
        referencia: form.referencia || '-',
        registradoPor: trab?.nombre ?? trab?.user_name ?? 'Sistema',
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
            placeholder='Buscar por factura o referencia...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={filtroMetodo}
          onChange={(e) => setFiltroMetodo(e.target.value)}
        >
          <option value=''>Todos los métodos</option>
          <option value='Transferencia'>Transferencia</option>
          <option value='Efectivo'>Efectivo</option>
          <option value='Tarjeta'>Tarjeta</option>
          <option value='PSE'>PSE</option>
        </select>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Registrar Nuevo Pago
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>ID Factura</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Método</th>
              <th>Referencia</th>
              <th>Registrado por</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className={styles.mono}>{p.id}</td>
                <td className={styles.factId}>{p.idFactura}</td>
                <td className={styles.monto}>{formatCOP(p.monto)}</td>
                <td>{formatDate(p.fecha)}</td>
                <td>
                  <span className={`${styles.badge} ${metodoBadge(p.metodo)}`}>
                    {p.metodo}
                  </span>
                </td>
                <td className={styles.mono}>{p.referencia}</td>
                <td>{p.registradoPor}</td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                    >⋮</button>
                    {menuOpen === p.id && (
                      <div className={styles.dropdown}>
                        <button onClick={() => setMenuOpen(null)}>📄 Ver detalle</button>
                        <button className={styles.dangerItem} onClick={() => {
                          setPagos(pagos.filter((x) => x.id !== p.id));
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
          <p className={styles.empty}>No se encontraron pagos.</p>
        )}
      </div>

      {showModal && (
        <PagoModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          facturas={facturas}
          trabajadores={trabajadores}
          pagos={pagos}
        />
      )}
    </div>
  );
}

export default Pagos;
