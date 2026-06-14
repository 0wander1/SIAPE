// Página principal del sistema. Carga en paralelo cuatro métricas clave
// y las presenta en tarjetas clicables que navegan a la sección correspondiente.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Dashboard.module.css';

// Milisegundos en un día. Se usa para convertir la diferencia entre fechas
// (que JavaScript expresa en ms) a días enteros.
const MS_DIA = 1000 * 60 * 60 * 24;

// Devuelve la fecha de hoy como string YYYY-MM-DD usando la hora LOCAL del
// navegador, no UTC. Esto evita desfases de un día cuando la zona horaria
// local está por detrás de UTC (p. ej. UTC-5 a medianoche devuelve el día anterior en UTC).
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Devuelve el primer día del mes actual como string YYYY-MM-DD en hora local.
// Se usa como fecha de inicio al consultar el balance de ventas del mes.
function firstOfMonthLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

// Calcula cuántos días faltan desde hoy hasta la fecha de vencimiento de un producto.
// - Primero extrae solo la parte de fecha (YYYY-MM-DD) descartando la hora con split('T'),
//   para que productos guardados como "2025-05-20T00:00:00Z" no sufran desfase de zona horaria.
// - Construye ambas fechas fijando la hora a medianoche local (T00:00:00) para que
//   la resta solo refleje diferencia de días, no de horas.
// - Math.ceil garantiza que un producto que vence hoy a las 23:59 cuente como 0 días
//   y no como fracción negativa.
// Devuelve un número negativo si el producto ya venció.
function diasHastaVencer(fechaStr) {
  const fechaSolo = fechaStr.split('T')[0];
  const vence = new Date(`${fechaSolo}T00:00:00`);
  const hoy   = new Date(`${todayLocal()}T00:00:00`);
  return Math.ceil((vence - hoy) / MS_DIA);
}

// Resuelve la clase CSS del badge de estado de un pedido.
// Acepta tanto los valores que devuelve el backend ('pendiente', 'en_proceso')
// como los textos de display ('Pendiente', 'En tránsito') para ser robusto
// ante inconsistencias de capitalización entre endpoints.
const estadoBadge = (estado) => {
  const map = {
    'pendiente':   styles.badgePending,
    'Pendiente':   styles.badgePending,
    'en_proceso':  styles.badgeTransit,
    'En tránsito': styles.badgeTransit,
    'entregado':   styles.badgeDelivered,
    'Entregado':   styles.badgeDelivered,
    'cancelado':   styles.badgeCancelled,
    'Cancelado':   styles.badgeCancelled,
  };
  return map[estado] || styles.badgePending;
};

// Tarjeta de métrica reutilizable. Recibe un `onClick` para que cada tarjeta
// navegue a la sección del sistema relevante para esa métrica, convirtiendo
// el dashboard en un panel de acceso rápido además de informativo.
// El color se aplica directamente como inline style: el icono usa el color
// con 12 % de opacidad (hex + '20') como fondo y el color sólido como texto.
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
  const [balanceVentas, setBalanceVentas]           = useState(0);
  const [productosVencer, setProductosVencer]       = useState([]);
  const [pedidosHoy, setPedidosHoy]                 = useState([]);
  const [proveedoresActivos, setProveedoresActivos] = useState(0);

  // tokenReady se inicializa de forma lazy: si el JWT ya está en localStorage al montar
  // el componente se arranca en true y la carga de datos ocurre de inmediato.
  // Si todavía no está disponible (p. ej. carrera de render en React 18 o Strict Mode)
  // queda en false y el efecto de polling de abajo lo pone en true en cuanto aparezca.
  const [tokenReady, setTokenReady] = useState(() => Boolean(localStorage.getItem('siape_token')));
  const pollRef = useRef(null);

  useEffect(() => {
    if (tokenReady) return;
    pollRef.current = setInterval(() => {
      if (localStorage.getItem('siape_token')) {
        setTokenReady(true);
        clearInterval(pollRef.current);
      }
    }, 50);
    return () => clearInterval(pollRef.current);
  }, [tokenReady]);

  // Carga de datos: solo se ejecuta cuando tokenReady pasa a true,
  // garantizando que el interceptor de Axios siempre encuentra el JWT en localStorage.
  useEffect(() => {
    if (!tokenReady) return;

    const hoy = todayLocal();
    const mes = firstOfMonthLocal();

    // ── Métrica 1: balance de ventas del mes actual ─────────────────────────
    // Consulta el resumen de ventas entre el primer día del mes y hoy.
    // El campo `ingresos_totales` puede llegar como string desde el backend,
    // por eso se convierte explícitamente con Number().
    api.get(`/reportes/ventas?fecha_inicio=${mes}&fecha_fin=${hoy}`)
      .then(({ data }) => setBalanceVentas(Number(data.resumen?.ingresos_totales) || 0))
      .catch(() => {});

    // ── Métrica 2: productos próximos a vencer ──────────────────────────────
    // Se necesitan dos recursos independientes: la lista de productos (para
    // las fechas de vencimiento) y el inventario (para el stock disponible).
    // Promise.all los lanza en paralelo y espera a que ambos terminen antes
    // de procesar los resultados, reduciendo el tiempo de carga a max(t1, t2)
    // en lugar de t1 + t2.
    Promise.all([api.get('/productos'), api.get('/inventario')])
      .then(([prodRes, invRes]) => {
        const inventario = invRes.data ?? [];

        const proximos = (prodRes.data ?? [])
          // Filtra los productos que vencen en un rango de 0 a 10 días.
          // - diasHastaVencer < 0 → ya venció → se excluye.
          // - diasHastaVencer > 10 → queda tiempo suficiente → se excluye.
          .filter((p) => {
            if (!p.fecha_vencimiento) return false;
            const dias = diasHastaVencer(p.fecha_vencimiento);
            return dias >= 0 && dias <= 10;
          })
          // Enriquece cada producto con su stock actual (cruzando por producto_id)
          // y precalcula diasRestantes para no tener que llamar a diasHastaVencer
          // de nuevo en el render.
          .map((p) => {
            const inv = inventario.find((i) => i.producto_id_producto === p.id_producto);
            return {
              ...p,
              cantidad_disponible: inv?.cantidad_disponible ?? '—',
              diasRestantes: diasHastaVencer(p.fecha_vencimiento),
            };
          })
          // Ordena de más urgente a menos urgente para que los productos
          // a punto de vencer aparezcan primero en la tabla.
          .sort((a, b) => a.diasRestantes - b.diasRestantes);

        console.log('productos', prodRes.data);
        console.log('diasRestantes', proximos);
        setProductosVencer(proximos);
      })
      .catch(() => {});

    // ── Métrica 3: pedidos con entrega estimada hoy ─────────────────────────
    // fechaEstimada llega como ISO string; slice(0, 10) extrae solo YYYY-MM-DD
    // para comparar con la fecha local de hoy sin considerar la hora.
    api.get('/pedidos')
      .then(({ data }) => {
        const filtrados = (data ?? []).filter(
          (p) => p.fechaEstimada?.slice(0, 10) === hoy
        );
        setPedidosHoy(filtrados);
      })
      .catch(() => {});

    // ── Métrica 4: proveedores con contrato activo ──────────────────────────
    // El campo `activo` puede ser 1 (MySQL tinyint) o true (boolean JSON),
    // por eso se compara con ambos valores para no excluir ninguno.
    api.get('/proveedores')
      .then(({ data }) => {
        const activos = (data ?? []).filter((p) => p.activo === 1 || p.activo === true);
        setProveedoresActivos(activos.length);
      })
      .catch(() => {});
  }, [tokenReady]);

  const hoy      = todayLocal();
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* ── Tarjetas de métricas ─────────────────────────────────────────────
          Cada MetricCard recibe un onClick que usa navigate() de React Router
          para llevar al usuario a la sección detallada de esa métrica.
          El color con sufijo '20' (hex de 12 % de opacidad) se genera en
          MetricCard para el fondo del icono sin necesidad de un color adicional. */}
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
        {/* ── Tabla de productos próximos a vencer ──────────────────────── */}
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
                      {/* El badge de días cambia de amarillo a rojo cuando
                          quedan 3 días o menos, para resaltar la urgencia. */}
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

        {/* ── Tabla de pedidos del día ───────────────────────────────────── */}
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
                      {/* estadoBadge() resuelve la clase CSS según el valor
                          del estado, tolerando variaciones de capitalización. */}
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
