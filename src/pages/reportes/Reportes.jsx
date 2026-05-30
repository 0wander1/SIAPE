// Página de reportes y métricas del negocio.
// Acceso exclusivo para administradores: esta ruta está envuelta en <AdminRoute>
// dentro de App.jsx, que verifica que user.cargo === 'admin' antes de renderizarla.
// Por eso este componente no importa useRole ni aplica controles propios: la
// protección ya ocurrió más arriba en el árbol de componentes.
//
// Contiene tres secciones independientes:
//  1. Reporte de Ventas (Node backend): rango de fechas → tarjetas resumen + gráfico.
//  2. Stock Crítico (Node backend): se carga junto con el reporte de ventas.
//  3. Resumen de Ventas Java (Tomcat): rango de fechas → consulta al servlet.

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCOP } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Reportes.module.css';

// Formatea los valores del eje Y del gráfico de barras de forma compacta
// para evitar que números grandes como 1 500 000 desborden el espacio disponible:
// ≥ 1 000 000 → "$1.5M", ≥ 1 000 → "$1.5K", de lo contrario el número entero.
const formatYAxis = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000)    return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

// Tooltip personalizado que reemplaza al tooltip genérico de Recharts.
// Recharts lo llama con { active, payload, label } cuando el usuario posiciona
// el cursor sobre una barra. `active` es true mientras el cursor está encima;
// `payload[0].value` contiene el valor numérico de la barra; `label` es el
// valor del eje X (la fecha de inicio de semana en este caso).
// Devuelve null cuando active es false para no renderizar nada fuera del hover.
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
  // ── Estado del Reporte de Ventas (Node) ───────────────────────────────────
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  // `generated` controla si las secciones de resultados (métricas + gráfico +
  // stock crítico) deben mostrarse. Permanece false hasta el primer "Generar".
  const [generated, setGenerated]     = useState(false);
  // `ventas` almacena el resumen y los datos por semana del backend Node.
  const [ventas, setVentas]           = useState(null);
  // `stockCritico` almacena los productos con stock por debajo del mínimo.
  const [stockCritico, setStockCritico] = useState([]);

  // ── Estado del Resumen de Ventas Java ─────────────────────────────────────
  // Cada sección tiene su propio juego de estados de carga/error/resultado para
  // que sean completamente independientes entre sí.
  const [javaFechaInicio, setJavaFechaInicio] = useState('');
  const [javaFechaFin, setJavaFechaFin]       = useState('');
  const [javaLoading, setJavaLoading]         = useState(false);
  const [javaError, setJavaError]             = useState('');
  const [javaResult, setJavaResult]           = useState(null);

  // Carga el stock crítico al montar para que el panel esté poblado antes de
  // que el usuario genere el reporte de ventas.
  useEffect(() => {
    api.get('/reportes/inventario')
      .then(({ data }) => setStockCritico(data.productos ?? []))
      .catch(() => {});
  }, []);

  // ── Resumen de Ventas Java: consulta al servlet ────────────────────────────
  // Usa fetch nativo (no axios) porque el servlet corre en Tomcat :8080,
  // fuera del backend Node que gestiona el interceptor de axios.
  // Los parámetros de fecha se envían como query strings.
  // Los nombres de los campos se leen con fallback (data.total_facturas ??
  // data.totalFacturas) porque el servlet puede devolver snake_case o camelCase
  // según la versión. Math.round elimina decimales del promedio.
  // - TypeError indica que Tomcat no está en ejecución o hay un error de red.
  // - Otro error proviene de una respuesta HTTP no-ok del servlet.
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

  // ── Reporte de Ventas + Stock Crítico (Node) ──────────────────────────────
  // Lanza dos peticiones en paralelo con Promise.all para minimizar el tiempo
  // de espera total (max(t_ventas, t_inventario) en lugar de su suma).
  //
  // /reportes/ventas recibe el rango de fechas como query params y devuelve:
  //   - resumen: { total_facturas, ingresos_totales, promedio_por_factura }
  //   - por_semana: [{ inicio_semana, ingresos }] → datos del gráfico de barras
  //
  // /reportes/inventario devuelve los productos con cantidad_disponible menor
  // que cantidad_minima, que se muestran en la tabla de stock crítico.
  //
  // Los valores numéricos se convierten explícitamente con Number() porque el
  // backend puede devolverlos como strings según el driver de MySQL.
  // Math.round elimina centavos del promedio para que la tarjeta sea legible.
  // `setGenerated(true)` hace que las secciones de resultados se monten en el DOM.
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
        // Mapea por_semana al shape { semana, ventas } que consume el BarChart.
        // `semana` va al eje X y `ventas` es el valor de cada barra.
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

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 1: Reporte de Ventas (Node backend)
          El formulario requiere ambas fechas (required); el botón se deshabilita
          durante la carga para evitar solicitudes duplicadas.
          Los resultados solo se renderizan después del primer "Generar" exitoso
          (generated === true && ventas !== null).
      ══════════════════════════════════════════════════════════════════════ */}
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
            {/* Tarjetas de resumen: tres métricas clave del periodo */}
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

            {/*
              Gráfico de barras con Recharts: ingresos agrupados por semana.

              ResponsiveContainer hace que el gráfico ocupe el 100 % del ancho
              del contenedor padre y respete la altura fija de 280 px,
              adaptándose automáticamente a cambios de tamaño de ventana.

              BarChart recibe `data` como el array ventas.porSemana con shape
              [{ semana: 'YYYY-MM-DD', ventas: number }].

              Ejes:
              - XAxis con dataKey='semana': muestra las fechas de inicio de semana.
                axisLine y tickLine en false eliminan las líneas decorativas del eje.
              - YAxis con tickFormatter=formatYAxis: usa el formateador compacto
                para no mostrar números como 1500000 en el eje.

              Tooltip: reemplazado por CustomTooltip para mostrar el valor
              formateado en COP en lugar del número crudo de Recharts.
              `cursor={{ fill: '#f0f9ff' }}` tiñe de azul claro el fondo de la
              barra al hacer hover, proporcionando retroalimentación visual.

              Bar: dataKey='ventas' conecta cada entrada del array con la altura
              de su barra. `radius={[6, 6, 0, 0]}` redondea solo las esquinas
              superiores para un aspecto más moderno.
            */}
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

      {/*
        ══════════════════════════════════════════════════════════════════════
        SECCIÓN 2: Stock Crítico (Node backend)
        Se renderiza condicionalmente con `generated` para que aparezca al mismo
        tiempo que el reporte de ventas, ya que ambos se generan con Promise.all.
        El déficit se calcula en el cliente como cantidad_disponible − cantidad_minima;
        un valor negativo indica cuántas unidades faltan para alcanzar el mínimo.
        Tanto el disponible como el déficit se muestran en rojo para resaltar urgencia.
        ══════════════════════════════════════════════════════════════════════
      */}
      {true && (
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
                      {/* El déficit es negativo cuando disponible < mínimo, lo que
                          confirma que el producto necesita reposición inmediata */}
                      <td style={{ color: '#dc2626' }}>{p.cantidad_disponible - p.cantidad_minima}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/*
        ══════════════════════════════════════════════════════════════════════
        SECCIÓN 3: Resumen de Ventas Java (Tomcat servlet)
        Sección completamente independiente de las anteriores: tiene su propio
        formulario de fechas, estados de carga/error y área de resultados.
        No usa axios sino fetch nativo porque el servlet corre en Tomcat :8080,
        fuera del alcance del interceptor de axios configurado en api.js.
        Los parámetros se pasan como query strings: ?fecha_inicio=...&fecha_fin=...
        Los resultados se muestran como tarjetas idénticas a las del reporte Node,
        facilitando la comparación entre ambas fuentes.
        ══════════════════════════════════════════════════════════════════════
      */}
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

        {/* Los resultados se montan solo cuando javaResult tiene datos,
            lo que ocurre tras una consulta exitosa al servlet. */}
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
