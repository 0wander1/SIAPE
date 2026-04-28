import { mockPedidos, mockProductosVencer, mockProveedores } from '../../utils/mockData.js';
import { formatCOP, formatDate } from '../../utils/format.js';
import styles from './Dashboard.module.css';

const pedidosHoy = mockPedidos.filter(
  (p) => p.fechaEstimada === '2026-04-27' && p.estado !== 'Cancelado'
);
const proveedoresHoy = mockProveedores.filter(
  (p) => p.fechaPedidoPendiente === '2026-04-27'
);

const balanceVentas = mockPedidos
  .filter((p) => p.estado === 'Entregado')
  .reduce((sum, p) => sum + p.valorTotal, 0);

const estadoBadge = (estado) => {
  const map = {
    'Pendiente': styles.badgePending,
    'En tránsito': styles.badgeTransit,
    'Entregado': styles.badgeDelivered,
    'Cancelado': styles.badgeCancelled,
  };
  return map[estado] || styles.badgePending;
};

function MetricCard({ title, value, sub, icon, color }) {
  return (
    <div className={styles.card}>
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
  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <MetricCard
          title='Balance de Ventas'
          value={formatCOP(balanceVentas)}
          sub='Pedidos entregados'
          icon='💰'
          color='#16a34a'
        />
        <MetricCard
          title='Productos Próximos a Vencer'
          value={mockProductosVencer.length}
          sub='En los próximos 10 días'
          icon='⚠️'
          color='#d97706'
        />
        <MetricCard
          title='Pedidos a Entregar Hoy'
          value={pedidosHoy.length}
          sub='27 de abril, 2026'
          icon='📦'
          color='#2563eb'
        />
        <MetricCard
          title='Proveedores que Entregan Hoy'
          value={proveedoresHoy.length}
          sub='Entregas programadas'
          icon='🏭'
          color='#7c3aed'
        />
      </div>

      <div className={styles.lists}>
        <div className={styles.listCard}>
          <h3 className={styles.listTitle}>Productos Próximos a Vencer</h3>
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
              {mockProductosVencer.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.stock} uds</td>
                  <td>{formatDate(p.fechaVencimiento)}</td>
                  <td>
                    <span
                      className={`${styles.diasBadge} ${
                        p.diasRestantes <= 3 ? styles.diasRed : styles.diasYellow
                      }`}
                    >
                      {p.diasRestantes} días
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                    <td>{p.cliente}</td>
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
