// Página de gestión de pagos. Permite registrar abonos parciales o totales
// contra facturas emitidas o con saldo pendiente, consultar el historial de
// pagos y validar el estado de una factura contra el servlet Java de Tomcat.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pagos.module.css';

// Resuelve la clase CSS del badge de método de pago.
// Tarjeta crédito y débito comparten la misma clase visual.
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

// ─────────────────────────────────────────────────────────────────────────────
// Modal de resultado de validación Java
// ─────────────────────────────────────────────────────────────────────────────
// Recibe el estado de la consulta al servlet como prop (`modal`) para reflejar
// sus tres fases: cargando, error de conexión o datos de validación.
// Los nombres de campo se leen con fallback (data.total ?? data.totalFactura)
// porque el servlet y el backend Node pueden devolver estructuras distintas.
function ValidarPagoModal({ modal, onClose }) {
  const { loading, error, data, facturaId } = modal;

  return (
    <Modal title={`Validación de Pago — Factura #${facturaId}`} onClose={onClose} size='md'>
      {loading && (
        <p className={styles.validLoading}>Consultando servidor Java (Tomcat)...</p>
      )}
      {error && (
        <div className={styles.validError}>{error}</div>
      )}
      {data && (
        <div className={styles.validGrid}>
          <div className={styles.validItem}>
            <p className={styles.validLabel}>Número de Factura</p>
            <p className={styles.validValue}>{data.numero_factura ?? data.numeroFactura ?? `#${facturaId}`}</p>
          </div>
          <div className={styles.validItem}>
            <p className={styles.validLabel}>Estado</p>
            {/* La clase del badge de estado se construye dinámicamente con el nombre
                del estado en minúsculas para que coincida con el selector CSS */}
            <span className={`${styles.estadoBadge} ${styles[`estado_${(data.estado ?? '').toLowerCase()}`]}`}>
              {data.estado ?? '—'}
            </span>
          </div>
          <div className={styles.validItem}>
            <p className={styles.validLabel}>Total Factura</p>
            <p className={styles.validValue}>{formatCOP(data.total ?? data.totalFactura ?? 0)}</p>
          </div>
          <div className={styles.validItem}>
            <p className={styles.validLabel}>Total Pagado</p>
            <p className={styles.validValue}>{formatCOP(data.total_pagado ?? data.totalPagado ?? 0)}</p>
          </div>
          <div className={styles.validItem}>
            <p className={styles.validLabel}>Saldo Pendiente</p>
            {/* El saldo se colorea en rojo si es mayor que 0 (hay deuda) o verde si es 0 */}
            <p className={`${styles.validValue} ${Number(data.saldo_pendiente ?? data.saldoPendiente ?? 0) > 0 ? styles.saldoNeg : styles.saldoOk}`}>
              {formatCOP(data.saldo_pendiente ?? data.saldoPendiente ?? 0)}
            </p>
          </div>
          <div className={styles.validItem}>
            <p className={styles.validLabel}>Completamente Pagada</p>
            {(data.completamente_pagada ?? data.completamentePagada) ? (
              <span className={styles.paidYes}>✓ Sí</span>
            ) : (
              <span className={styles.paidNo}>✗ No</span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de registro de nuevo pago
// ─────────────────────────────────────────────────────────────────────────────
// Recibe `pagos` (además de `facturas`) para poder calcular cuánto se ha abonado
// ya a la factura seleccionada y mostrar el saldo pendiente en tiempo real.
function PagoModal({ onClose, onSave, facturas, pagos, pagoError }) {
  const [form, setForm] = useState({
    idFactura: '', monto: '', fecha: '', metodo: 'transferencia', referencia: '',
  });

  // `saldoInfo` contiene { total, pagado, saldo } de la factura seleccionada.
  // Se recalcula cada vez que el usuario cambia la factura elegida.
  const [saldoInfo, setSaldoInfo]         = useState(null);
  const [loadingSaldo, setLoadingSaldo]   = useState(false);

  // Campo de búsqueda libre para filtrar el select de facturas por número.
  const [searchFactura, setSearchFactura] = useState('');

  // ── Saldo pendiente en tiempo real ────────────────────────────────────────
  // Se ejecuta cada vez que form.idFactura cambia.
  // 1. Si no hay factura seleccionada limpia saldoInfo y sale.
  // 2. Solicita el total de la factura al backend con GET /facturas/:id.
  // 3. Suma todos los pagos existentes que apunten a esa factura usando el
  //    array `pagos` ya cargado en el padre (evita una petición extra al servidor).
  // 4. Calcula el saldo como total − ya_pagado y actualiza saldoInfo.
  // El panel azul que muestra total / ya pagado / saldo se renderiza de inmediato
  // cuando saldoInfo tiene datos, dando retroalimentación visual instantánea.
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
        {pagoError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 14 }}>
            {pagoError}
          </div>
        )}
        <FormRow>
          {/* Campo de búsqueda libre para filtrar el select de facturas por número */}
          <FormField label='Buscar factura'>
            <Input
              value={searchFactura}
              onChange={(e) => setSearchFactura(e.target.value)}
              placeholder='Número de factura...'
            />
          </FormField>

          {/*
            Select de facturas filtradas por dos criterios simultáneos:
            1. Estado: solo se muestran facturas en estado 'emitida' o 'parcial'.
               Las facturas 'pagadas' y 'anuladas' se excluyen porque no tienen
               saldo pendiente o ya no son válidas para recibir abonos.
            2. Búsqueda: solo las que contienen el texto de searchFactura en su
               número de factura (comparación case-insensitive).
          */}
          <FormField label='Factura Asociada' required>
            <Select
              value={form.idFactura}
              onChange={(e) => setForm({ ...form, idFactura: e.target.value })}
              required
            >
              <option value=''>Seleccionar factura...</option>
              {facturas.filter((f) =>
                (f.estado === 'emitida' || f.estado === 'parcial') &&
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

        {/* Indicador de carga mientras se consulta el total de la factura */}
        {loadingSaldo && (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Cargando saldo...</p>
        )}

        {/*
          Panel informativo de saldo pendiente en tiempo real.
          Se muestra en cuanto saldoInfo tiene datos (después de elegir una factura).
          El saldo pendiente se colorea:
          - Verde si es 0: la factura ya estaría completamente cubierta.
          - Rojo si es > 0: aún queda deuda por saldar.
          Este panel ayuda al usuario a saber exactamente cuánto debe ingresar
          como monto del pago sin tener que buscar la factura por separado.
        */}
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
          {/*
            Validación de fecha para no permitir fechas futuras.
            El atributo `max` del input de fecha se fija dinámicamente con la
            fecha de hoy en formato YYYY-MM-DD, obtenida con:
              new Date().toISOString().slice(0, 10)
            El navegador deshabilita automáticamente cualquier fecha posterior
            a ese valor, impidiendo que se registre un pago con fecha futura.
          */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Pagos() {
  const { isAdmin } = useRole();

  const [pagos, setPagos]               = useState([]);
  const [facturas, setFacturas]         = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);

  const [search, setSearch]             = useState('');
  // Filtro por método de pago; cadena vacía significa "todos los métodos".
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [showModal, setShowModal]       = useState(false);

  // `menuOpen` guarda el id_pago del menú ⋮ abierto, o null si ninguno.
  const [menuOpen, setMenuOpen] = useState(null);

  // `confirmDelete` almacena el pago pendiente de eliminar.
  const [confirmDelete, setConfirmDelete] = useState(null);
  // `errorMsg` alimenta el banner de error rojo con auto-cierre.
  const [errorMsg, setErrorMsg] = useState('');
  // `pagoError` muestra errores del guardado dentro del modal.
  const [pagoError, setPagoError] = useState('');

  // `validacionModal` lleva el estado de la consulta al servlet Java:
  // null → modal cerrado; { facturaId, loading: true } → consultando;
  // { facturaId, data } → éxito; { facturaId, error } → fallo de conexión.
  const [validacionModal, setValidacionModal] = useState(null);

  // ── Cierre del menú de tres puntos al hacer clic fuera ───────────────────
  // El listener global de 'click' resetea menuOpen a null en cualquier clic
  // que no sea detenido por e.stopPropagation(). El botón ⋮ usa stopPropagation
  // para que el clic que abre el menú no lo cierre inmediatamente.
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // Los tres recursos se solicitan en paralelo al montar el componente.
  // `pagos` se pasa al PagoModal para calcular el saldo ya abonado sin
  // peticiones extra; `facturas` filtra las disponibles en el select del modal.
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

  // ── Filtro combinado búsqueda + método ────────────────────────────────────
  // Filtra sobre el array en memoria sin peticiones al servidor.
  // - matchSearch: ID de factura o referencia de transacción contienen el texto.
  // - matchMetodo: si filtroMetodo está vacío pasan todos; si no, solo los que
  //   coincidan exactamente con el método seleccionado.
  const filtered = pagos.filter((p) => {
    const matchSearch =
      String(p.factura_id_factura ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.referencia_transaccion ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.numero_factura ?? '').toLowerCase().includes(search.toLowerCase());
    const matchMetodo = !filtroMetodo || p.metodo_pago === filtroMetodo;
    return matchSearch && matchMetodo;
  });

  // ── Botón Validar: consulta al servlet Java ───────────────────────────────
  // Abre el modal de validación en estado "cargando" de inmediato y luego hace
  // un fetch nativo (no axios) al servlet ValidacionPagoServlet en Tomcat :8080,
  // pasando el ID de la factura como query param.
  // - TypeError indica que el servidor no está levantado o hay un problema de red.
  // - Otro error proviene de una respuesta HTTP no-ok del servlet.
  // El modal ya está montado en estado loading, por lo que el usuario ve
  // retroalimentación visual aunque la respuesta tarde varios segundos.
  const handleValidarJava = async (facturaId) => {
    setValidacionModal({ facturaId, loading: true });
    try {
      const res = await fetch(`http://localhost:8080/SIAPE-Servlets/ValidacionPagoServlet?id_factura=${facturaId}`);
      if (!res.ok) throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
      const data = await res.json();
      // Reemplaza el estado loading con los datos recibidos; el modal cambia
      // de "Consultando..." a mostrar la tabla de resultados.
      setValidacionModal({ facturaId, data });
    } catch (err) {
      if (err instanceof TypeError) {
        setValidacionModal({ facturaId, error: 'No se pudo conectar con el servidor Java (Tomcat). Verifique que esté en ejecución en el puerto 8080.' });
      } else {
        setValidacionModal({ facturaId, error: err.message || 'Error al validar el pago.' });
      }
    }
  };

  // ── Eliminación con confirmación ──────────────────────────────────────────
  // Se invoca solo cuando el usuario confirma en el banner.
  // Cierra el banner antes del request; filtra el pago del estado local si tiene éxito.
  const handleConfirmDelete = async () => {
    const p = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/pagos/${p.id_pago}`);
      setPagos((prev) => prev.filter((x) => x.id_pago !== p.id_pago));
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar pago';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // ── Registrar pago ────────────────────────────────────────────────────────
  // Lee el ID del trabajador autenticado desde localStorage para adjuntarlo
  // como usuario_trab_id_usuario_trab, registrando quién procesó el pago.
  // Tras el POST recarga la lista completa para reflejar los cambios de estado
  // de la factura (p. ej. 'parcial' → 'pagada') que el backend puede haber
  // actualizado automáticamente según el saldo resultante.
  const handleSave = async (form) => {
    const storedUser    = JSON.parse(localStorage.getItem('siape_user') || 'null');
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
      const msg = error.response?.data?.message || 'Error al registrar pago';
      setPagoError(msg);
    }
  };

  return (
    <div className={styles.page}>
      {errorMsg && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
          borderRadius: 8, padding: '10px 16px', fontSize: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg('')}
            style={{ background: 'none', color: '#dc2626', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
          >✕</button>
        </div>
      )}

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
        {/* Filtro por método de pago; se combina con la búsqueda de texto (AND) */}
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
        <button className={styles.btnNew} onClick={() => { setShowModal(true); setPagoError(''); }}>
          + Registrar Nuevo Pago
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Los pagos no tienen edición; el único cambio destructivo es eliminarlos. */}
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
              <th>Número Factura</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Método</th>
              <th>Referencia</th>
              <th>Registrado por</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id_pago}>
                <td className={styles.mono}>{p.id_pago}</td>
                <td className={styles.factId}>{p.numero_factura ?? p.factura_id_factura}</td>
                <td className={styles.monto}>{formatCOP(p.monto_pagado)}</td>
                <td>{formatDate(p.fecha_pago)}</td>
                <td>
                  <span className={`${styles.badge} ${metodoBadge(p.metodo_pago)}`}>
                    {p.metodo_pago}
                  </span>
                </td>
                <td className={styles.mono}>{p.referencia_transaccion ?? '—'}</td>
                <td className={styles.mono}>{p.usuario_trab_id_usuario_trab ?? '—'}</td>
                <td>
                  {/*
                    Botón Validar: disponible para todos los usuarios (no solo admins).
                    Al hacer clic abre el modal de validación en estado loading y
                    lanza la consulta al servlet Java ValidacionPagoServlet con el
                    ID de la factura asociada al pago como parámetro de query.
                  */}
                  <button
                    className={styles.btnValidar}
                    onClick={() => handleValidarJava(p.factura_id_factura)}
                  >
                    ☕ Validar
                  </button>
                </td>
                <td className={styles.menuCell}>
                  {/*
                    Menú de tres puntos exclusivo para administradores.
                    Solo contiene la opción Eliminar porque los pagos no se editan
                    (un pago ya registrado es un registro contable inmutable).
                    e.stopPropagation() evita que el listener global cierre el menú
                    en el mismo evento que lo abre.
                  */}
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
          onClose={() => { setShowModal(false); setPagoError(''); }}
          onSave={handleSave}
          facturas={facturas}
          pagos={pagos}
          pagoError={pagoError}
        />
      )}

      {/* El modal de validación se monta cuando validacionModal no es null.
          Al cerrarse setValidacionModal(null) lo desmonta y libera su estado. */}
      {validacionModal && (
        <ValidarPagoModal
          modal={validacionModal}
          onClose={() => setValidacionModal(null)}
        />
      )}
    </div>
  );
}

export default Pagos;
