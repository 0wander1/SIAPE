import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { mockPedidos, mockVentasSemana } from '../../utils/mockData.js';
import { formatCOP } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Reportes.module.css';

const mockTotalPedidos = mockPedidos.filter((p) => p.estado !== 'Cancelado').length;
const mockIngresosTotales = mockPedidos
  .filter((p) => p.estado === 'Entregado')
  .reduce((s, p) => s + p.valorTotal, 0);
const mockEntregados = mockPedidos.filter((p) => p.estado === 'Entregado').length;
const mockPromedioPedido = mockEntregados > 0 ? Math.round(mockIngresosTotales / mockEntregados) : 0;

const formatYAxis = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        <p className={styles.tooltipValue}>{formatCOP(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

function Reportes() {
  const [fechaInicio, setFechaInicio] = useState('2026-04-01');
  const [fechaFin, setFechaFin] = useState('2026-04-30');
  const [generated, setGenerated] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({
    totalPedidos: mockTotalPedidos,
    ingresosTotales: mockIngresosTotales,
    promedioPedido: mockPromedioPedido,
    ventasSemana: mockVentasSemana,
  });

  const handleGenerar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const [ventasRes] = await Promise.all([
        api.get(`/reportes/ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`),
        api.get('/reportes/inventario'),
      ]);

      const v = ventasRes.data;
      setReporteData({
        totalPedidos: v.totalPedidos ?? mockTotalPedidos,
        ingresosTotales: v.ingresosTotales ?? mockIngresosTotales,
        promedioPedido: v.promedioPedido ?? mockPromedioPedido,
        ventasSemana: v.ventasPorSemana ?? v.ventasSemana ?? mockVentasSemana,
      });
    } catch {
      setReporteData({
        totalPedidos: mockTotalPedidos,
        ingresosTotales: mockIngresosTotales,
        promedioPedido: mockPromedioPedido,
        ventasSemana: mockVentasSemana,
      });
    } finally {
      setLoading(false);
      setGenerated(true);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.title}>Reportes</h2>
        <p className={styles.subtitle}>Análisis y métricas de rendimiento del negocio</p>
      </div>

      <div className={styles.reportCard}>
        <div className={styles.reportHeader}>
          <h3 className={styles.reportTitle}>📈 Reporte de Ventas</h3>
        </div>

        <form className={styles.dateRow} onSubmit={handleGenerar}>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Fecha inicio</label>
            <input
              type='date' className={styles.dateInput}
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Fecha fin</label>
            <input
              type='date' className={styles.dateInput}
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <button type='submit' className={styles.btnGenerar} disabled={loading}>
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
        </form>

        {generated && (
          <>
            <div className={styles.metrics}>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Total Pedidos</p>
                <p className={styles.metricValue}>{reporteData.totalPedidos}</p>
                <p className={styles.metricSub}>Pedidos activos</p>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Ingresos Totales</p>
                <p className={styles.metricValue}>{formatCOP(reporteData.ingresosTotales)}</p>
                <p className={styles.metricSub}>Pedidos entregados</p>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Promedio por Pedido</p>
                <p className={styles.metricValue}>{formatCOP(reporteData.promedioPedido)}</p>
                <p className={styles.metricSub}>Por pedido entregado</p>
              </div>
            </div>

            <div className={styles.chartSection}>
              <h4 className={styles.chartTitle}>Ventas por Semana</h4>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width='100%' height={280}>
                  <BarChart
                    data={reporteData.ventasSemana}
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis
                      dataKey='semana'
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0f9ff' }} />
                    <Bar dataKey='ventas' fill='#2563eb' radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Reportes;
