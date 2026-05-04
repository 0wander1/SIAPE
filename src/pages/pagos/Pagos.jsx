import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pagos.module.css';

const metodoBadge = (metodo) => {
  const map = {
    'transferencia':   styles.badgeTransfer,
    'efectivo':        styles.badgeCash,
    'tarjeta_credito': styles.badgeCard,
    'tarjeta_debito':  styles.badgeCard,
    'cheque':          styles.badgePse,
  };
  return map[metodo] || styles.badgeTransfer;
};

function PagoModal({ onClose, onSave, facturas, pagos }) {
  const [form, setForm] = useState({
    idFactura: '', monto: '', fecha: '', metodo: 'transferencia', referencia: '',
  });
  const [saldoInfo, setSaldoInfo] = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [searchFactura, setSearchFactura] = useState('');

  useEffect(() => {
    if (!form.idFactura) { setSaldoInfo(null); return; }
    setLoadingSaldo(true);
    api.get(`/facturas/${form.idFactura}`)
      .then(({ data }) => {
        const pagado = pagos
          .filter((p) => p.factura_id_factura == form.idFactura)
          .reduce((s, p) => s + Number(p.monto_pagado ?? 0), 0);
        const total = Number(data.total ?? 0);
        setSaldoInfo({ total, pagado, saldo: total - pagado });
      })
      .catch(() => setSaldoInfo(null))
      .finally(() => setLoadingSaldo(false));
  }, [form.idFactura]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Registrar Nuevo Pago' onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormRow>
          <FormField label='Buscar factura'>
            <Input
              value={searchFactura}
              onChange={(e) => setSearchFactura(e.target.value)}
              placeholder='Número de factura...'
            />
          </FormField>
          <FormField label='Factura Asociada' required>
            <Select
              value={form.idFactura}
              onChange={(e) => setForm({ ...form, idFactura: e.target.value })}
              required
            >
              <option value=''>Seleccionar factura...</option>
              {facturas.filter((f) => (f.estado === 'emitida' || f.estado === 'parcial') &&
                (f.numero_factura ?? f.numeroFactura ?? '').toLowerCase().includes(searchFactura.toLowerCase())
              ).map((f) => {
                const fId  = f.id_factura ?? f.id;
                const fNum = f.numero_factura ?? f.numeroFactura;
                return (
                  <option key={fId} value={fId}>
                    {fNum} — {formatCOP(f.total ?? 0)}
                  </option>
                );
              })}
            </Select>
          </FormField>
        </FormRow>

        {loadingSaldo && (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Cargando saldo...</p>
        )}
        {saldoInfo && (
          <div style={{
            background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 8,
            padding: '12px 16px', fontSize: 13, display: 'flex', gap: 24, flexWrap: 'wrap',
          }}>
            <span>Total factura: <strong>{formatCOP(saldoInfo.total)}</strong></span>
            <span>Ya pagado: <strong>{formatCOP(saldoInfo.pagado)}</strong></span>
            <span>Saldo pendiente: <strong style={{ color: saldoInfo.saldo === 0 ? '#16a34a' : '#dc2626' }}>
              {formatCOP(saldoInfo.saldo)}
            </strong></span>
          </div>
        )}

        <FormRow>
          <FormField label='Monto del Pago (COP)' required>
            <Input type='number' min='1' value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              placeholder='0' required />
          </FormField>
          <FormField label='Fecha del Pago' required>
            <Input type='date' value={form.fecha}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Método de Pago'>
            <Select value={form.metodo}
              onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
              <option value='transferencia'>Transferencia</option>
              <option value='efectivo'>Efectivo</option>
              <option value='tarjeta_credito'>Tarjeta Crédito</option>
              <option value='tarjeta_debito'>Tarjeta Débito</option>
              <option value='cheque'>Cheque</option>
            </Select>
          </FormField>
          <FormField label='Referencia'>
            <Input value={form.referencia}
              onChange={(e) => setForm({ ...form, referencia: e.target.value })}
              placeholder='Número de comprobante' />
          </FormField>
        </FormRow>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Registrar Pago</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Pagos() {
  const { isAdmin } = useRole();
  const [pagos, setPagos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [search, setSearch] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
      String(p.factura_id_factura ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.referencia_transaccion ?? '').toLowerCase().includes(search.toLowerCase());
    const matchMetodo = !filtroMetodo || p.metodo_pago === filtroMetodo;
    return matchSearch && matchMetodo;
  });

  const handleConfirmDelete = async () => {
    const p = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/pagos/${p.id_pago}`);
      setPagos((prev) => prev.filter((x) => x.id_pago !== p.id_pago));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Error al eliminar pago');
    }
  };

  const handleSave = async (form) => {
    const storedUser = JSON.parse(localStorage.getItem('siape_user') || 'null');
    const usuarioTrabId = storedUser?.id || null;
    try {
      await api.post('/pagos', {
        monto_pagado:                 Number(form.monto),
        fecha_pago:                   form.fecha,
        metodo_pago:                  form.metodo,
        referencia_transaccion:       form.referencia || null,
        factura_id_factura:           Number(form.idFactura),
        usuario_trab_id_usuario_trab: usuarioTrabId,
      });
      const { data } = await api.get('/pagos');
      setPagos(data);
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Error al registrar pago');
    }
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
          <option value='transferencia'>Transferencia</option>
          <option value='efectivo'>Efectivo</option>
          <option value='tarjeta_credito'>Tarjeta Crédito</option>
          <option value='tarjeta_debito'>Tarjeta Débito</option>
          <option value='cheque'>Cheque</option>
        </select>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Registrar Nuevo Pago
        </button>
      </div>

      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el pago <strong>#{confirmDelete.id_pago}</strong>? Esta acción no se puede deshacer.</span>
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
              <tr key={p.id_pago}>
                <td className={styles.mono}>{p.id_pago}</td>
                <td className={styles.factId}>{p.factura_id_factura}</td>
                <td className={styles.monto}>{formatCOP(p.monto_pagado)}</td>
                <td>{formatDate(p.fecha_pago)}</td>
                <td>
                  <span className={`${styles.badge} ${metodoBadge(p.metodo_pago)}`}>
                    {p.metodo_pago}
                  </span>
                </td>
                <td className={styles.mono}>{p.referencia_transaccion ?? '—'}</td>
                <td className={styles.mono}>{p.usuario_trab_id_usuario_trab ?? '—'}</td>
                <td className={styles.menuCell}>
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === p.id_pago ? null : p.id_pago); }}
                      >⋮</button>
                      {menuOpen === p.id_pago && (
                        <div className={styles.dropdown}>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(p); setMenuOpen(null); }}
                          >🗑️ Eliminar</button>
                        </div>
                      )}
                    </div>
                  )}
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
          pagos={pagos}
        />
      )}
    </div>
  );
}

export default Pagos;
