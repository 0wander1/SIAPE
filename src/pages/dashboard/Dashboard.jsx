import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Dashboard.module.css';

const MS_DIA = 1000 * 60 * 60 * 24;

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstOfMonthLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

function diasHastaVencer(fechaStr) {
  const vence = new Date(`${fechaStr}T00:00:00`);
  const hoy   = new Date(`${todayLocal()}T00:00:00`);
  return Math.ceil((vence - hoy) / MS_DIA);
}

const estadoBadge = (estado) => {
  const map = {
    'pendiente':    styles.badgePending,
    'Pendiente':    styles.badgePending,
    'en_proceso':   styles.badgeTransit,
    'En tránsito':  styles.badgeTransit,
    'entregado':    styles.badgeDelivered,
    'Entregado':    styles.badgeDelivered,
    'cancelado':    styles.badgeCancelled,
    'Cancelado':    styles.badgeCancelled,
  };
  return map[estado] || styles.badgePending;
};

function MetricCard({ title, value, sub, icon, color, onClick }) {
  return (
    <div className={styles.card} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className={styles.cardIcon} style={{ backgroundColor: color + '20', color }}>
        {icon}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{title}</p>
        <p className={styles.cardValue}>{value}</p>
        {sub && <p className={styles.cardSub}>{sub}</p>}
      </div>
    </div>
  );
}

function Dashboard() {
  const [balanceVentas, setBalanceVentas]       = useState(0);
  const [productosVencer, setProductosVencer]   = useState([]);
  const [pedidosHoy, setPedidosHoy]             = useState([]);
  const [proveedoresActivos, setProveedoresActivos] = useState(0);

  useEffect(() => {
    const hoy  = todayLocal();
    const mes  = firstOfMonthLocal();

    // Balance de ventas del mes actual (facturas no anuladas)
    api.get(`/reportes/ventas?fecha_inicio=${mes}&fecha_fin=${hoy}`)
      .then(({ data }) => setBalanceVentas(Number(data.resumen?.ingresos_totales) || 0))
      .catch(() => {});

    // Productos próximos a vencer en los próximos 10 días
    Promise.all([api.get('/productos'), api.get('/inventario')])
      .then(([prodRes, invRes]) => {
        const inventario = invRes.data ?? [];
        const proximos = (prodRes.data ?? [])
          .filter((p) => {
            if (!p.fecha_vencimiento) return false;
            const dias = diasHastaVencer(p.fecha_vencimiento);
            return dias >= 0 && dias <= 10;
          })
          .map((p) => {
            const inv = inventario.find((i) => i.producto_id_producto === p.id_producto);
            return {
              ...p,
              cantidad_disponible: inv?.cantidad_disponible ?? '—',
              diasRestantes: diasHastaVencer(p.fecha_vencimiento),
            };
          })
          .sort((a, b) => a.diasRestantes - b.diasRestantes);
        setProductosVencer(proximos);
      })
      .catch(() => {});

    // Pedidos con entrega estimada hoy
    api.get('/pedidos')
      .then(({ data }) => {
        const filtrados = (data ?? []).filter(
          (p) => p.fechaEstimada?.slice(0, 10) === hoy
        );
        setPedidosHoy(filtrados);
      })
      .catch(() => {});

    // Proveedores con contrato activo
    api.get('/proveedores')
      .then(({ data }) => {
        const activos = (data ?? []).filter((p) => p.activo === 1 || p.activo === true);
        setProveedoresActivos(activos.length);
      })
      .catch(() => {});
  }, []);

  const hoy = todayLocal();
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <MetricCard
          title='Balance de Ventas'
          value={formatCOP(balanceVentas)}
          sub='Mes actual — facturas emitidas'
          icon='💰'
          color='#16a34a'
          onClick={() => navigate('/reportes')}
        />
        <MetricCard
          title='Productos Próximos a Vencer'
          value={productosVencer.length}
          sub='En los próximos 10 días'
          icon='⚠️'
          color='#d97706'
          onClick={() => navigate('/productos')}
        />
        <MetricCard
          title='Pedidos a Entregar Hoy'
          value={pedidosHoy.length}
          sub={hoy}
          icon='📦'
          color='#2563eb'
          onClick={() => navigate('/pedidos')}
        />
        <MetricCard
          title='Proveedores Activos'
          value={proveedoresActivos}
          sub='Con contrato vigente'
          icon='🏭'
          color='#7c3aed'
          onClick={() => navigate('/proveedores')}
        />
      </div>

      <div className={styles.lists}>
        <div className={styles.listCard}>
          <h3 className={styles.listTitle}>Productos Próximos a Vencer</h3>
          {productosVencer.length === 0 ? (
            <p className={styles.empty}>No hay productos próximos a vencer.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th>Vence</th>
                  <th>Días</th>
                </tr>
              </thead>
              <tbody>
                {productosVencer.map((p) => (
                  <tr key={p.id_producto}>
                    <td>{p.nombre_producto}</td>
                    <td>{p.cantidad_disponible} uds</td>
                    <td>{formatDate(p.fecha_vencimiento)}</td>
                    <td>
                      <span className={`${styles.diasBadge} ${
                        p.diasRestantes <= 3 ? styles.diasRed : styles.diasYellow
                      }`}>
                        {p.diasRestantes} días
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.listCard}>
          <h3 className={styles.listTitle}>Pedidos del Día</h3>
          {pedidosHoy.length === 0 ? (
            <p className={styles.empty}>No hay pedidos programados para hoy.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {pedidosHoy.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.mono}>{p.id}</td>
                    <td>{p.cliente ?? '—'}</td>
                    <td>
                      <span className={`${styles.badge} ${estadoBadge(p.estado)}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td>{formatCOP(p.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
