import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCOP } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Reportes.module.css';

const formatYAxis = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000)    return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      <p className={styles.tooltipValue}>{formatCOP(payload[0].value)}</p>
    </div>
  );
};

function Reportes() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [generated, setGenerated]     = useState(false);
  const [ventas, setVentas]           = useState(null);
  const [stockCritico, setStockCritico] = useState([]);

  const [javaFechaInicio, setJavaFechaInicio] = useState('');
  const [javaFechaFin, setJavaFechaFin]       = useState('');
  const [javaLoading, setJavaLoading]         = useState(false);
  const [javaError, setJavaError]             = useState('');
  const [javaResult, setJavaResult]           = useState(null);

  const handleConsultarJava = async (e) => {
    e.preventDefault();
    setJavaLoading(true);
    setJavaError('');
    setJavaResult(null);
    try {
      const url = `http://localhost:8080/SIAPE-Servlets/ResumenVentasServlet?fecha_inicio=${javaFechaInicio}&fecha_fin=${javaFechaFin}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
      const data = await res.json();
      setJavaResult({
        totalFacturas:      Number(data.total_facturas     ?? data.totalFacturas     ?? 0),
        ingresosTotales:    Number(data.ingresos_totales   ?? data.ingresosTotales   ?? 0),
        promedioPorFactura: Math.round(Number(data.promedio_por_factura ?? data.promedioPorFactura ?? 0)),
      });
    } catch (err) {
      if (err instanceof TypeError) {
        setJavaError('No se pudo conectar con el servidor Java (Tomcat). Verifique que esté en ejecución en el puerto 8080.');
      } else {
        setJavaError(err.message || 'Error al consultar el resumen de ventas.');
      }
    } finally {
      setJavaLoading(false);
    }
  };

  const handleGenerar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const [ventasRes, invRes] = await Promise.all([
        api.get(`/reportes/ventas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`),
        api.get('/reportes/inventario'),
      ]);

      const v = ventasRes.data;
      setVentas({
        totalPedidos:    Number(v.resumen.total_facturas),
        ingresosTotales: Number(v.resumen.ingresos_totales),
        promedioPedido:  Math.round(Number(v.resumen.promedio_por_factura)),
        porSemana: (v.por_semana ?? []).map((s) => ({
          semana: s.inicio_semana,
          ventas: Number(s.ingresos),
        })),
      });
      setStockCritico(invRes.data.productos ?? []);
      setGenerated(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.title}>Reportes</h2>
        <p className={styles.subtitle}>Análisis y métricas de rendimiento del negocio</p>
      </div>

      {/* ── Reporte de Ventas ── */}
      <div className={styles.reportCard}>
        <div className={styles.reportHeader}>
          <h3 className={styles.reportTitle}>📈 Reporte de Ventas</h3>
        </div>

        <form className={styles.dateRow} onSubmit={handleGenerar}>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Fecha inicio</label>
            <input
              type='date' className={styles.dateInput} required
              value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Fecha fin</label>
            <input
              type='date' className={styles.dateInput} required
              value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <button type='submit' className={styles.btnGenerar} disabled={loading}>
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
        </form>

        {error && <p className={styles.errorBanner}>{error}</p>}

        {generated && ventas && (
          <>
            <div className={styles.metrics}>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Total Facturas</p>
                <p className={styles.metricValue}>{ventas.totalPedidos}</p>
                <p className={styles.metricSub}>En el periodo seleccionado</p>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Ingresos Totales</p>
                <p className={styles.metricValue}>{formatCOP(ventas.ingresosTotales)}</p>
                <p className={styles.metricSub}>Suma de totales facturados</p>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Promedio por Factura</p>
                <p className={styles.metricValue}>{formatCOP(ventas.promedioPedido)}</p>
                <p className={styles.metricSub}>Valor promedio por factura</p>
              </div>
            </div>

            <div className={styles.chartSection}>
              <h4 className={styles.chartTitle}>Ingresos por Semana</h4>
              {ventas.porSemana.length === 0 ? (
                <p className={styles.empty}>Sin datos para el periodo seleccionado.</p>
              ) : (
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width='100%' height={280}>
                    <BarChart data={ventas.porSemana} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                      <XAxis
                        dataKey='semana'
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0f9ff' }} />
                      <Bar dataKey='ventas' fill='#2563eb' radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Stock Crítico ── */}
      {generated && (
        <div className={styles.reportCard}>
          <div className={styles.reportHeaderRow}>
            <h3 className={styles.reportTitle}>⚠️ Productos con Stock Crítico</h3>
            <span className={styles.criticalBadge}>{stockCritico.length} productos</span>
          </div>

          {stockCritico.length === 0 ? (
            <p className={styles.empty}>No hay productos con stock crítico.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Bodega</th>
                    <th>Disponible</th>
                    <th>Mínimo</th>
                    <th>Déficit</th>
                  </tr>
                </thead>
                <tbody>
                  {stockCritico.map((p) => (
                    <tr key={p.id_inventario}>
                      <td>{p.nombre_producto}</td>
                      <td>{p.descripcion_bodega}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>{p.cantidad_disponible}</td>
                      <td>{p.cantidad_minima}</td>
                      <td style={{ color: '#dc2626' }}>{p.cantidad_disponible - p.cantidad_minima}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Resumen de Ventas (Java) ── */}
      <div className={styles.reportCard}>
        <div className={styles.reportHeader}>
          <h3 className={styles.reportTitle}>☕ Resumen de Ventas (Java)</h3>
        </div>

        <form className={styles.dateRow} onSubmit={handleConsultarJava}>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Fecha inicio</label>
            <input
              type='date' className={styles.dateInput} required
              value={javaFechaInicio} onChange={(e) => setJavaFechaInicio(e.target.value)}
            />
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Fecha fin</label>
            <input
              type='date' className={styles.dateInput} required
              value={javaFechaFin} onChange={(e) => setJavaFechaFin(e.target.value)}
            />
          </div>
          <button type='submit' className={styles.btnConsultar} disabled={javaLoading}>
            {javaLoading ? 'Consultando...' : 'Consultar'}
          </button>
        </form>

        {javaError && <p className={styles.errorBanner}>{javaError}</p>}

        {javaResult && (
          <div className={styles.metrics}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Total Facturas</p>
              <p className={styles.metricValue}>{javaResult.totalFacturas}</p>
              <p className={styles.metricSub}>En el periodo seleccionado</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Ingresos Totales</p>
              <p className={styles.metricValue}>{formatCOP(javaResult.ingresosTotales)}</p>
              <p className={styles.metricSub}>Suma de totales facturados</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Promedio por Factura</p>
              <p className={styles.metricValue}>{formatCOP(javaResult.promedioPorFactura)}</p>
              <p className={styles.metricSub}>Valor promedio por factura</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reportes;
