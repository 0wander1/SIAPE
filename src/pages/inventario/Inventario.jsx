// Página de gestión de inventario. Permite listar, filtrar, editar y eliminar
// entradas del inventario, exportar el listado a Excel, cargar actualizaciones
// masivas desde un archivo Excel, y consultar el stock crítico via un servlet Java.

import { useState, useEffect, useRef } from 'react';
import useRole from '../../hooks/useRole.js';
import * as XLSX from 'xlsx';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Inventario.module.css';

// Clasifica el nivel de stock de un ítem de inventario en tres estados:
// - statusCritical: disponible ≤ 50 % del mínimo → nivel de alerta máximo (rojo).
// - statusLow:      disponible ≤ mínimo           → por debajo del umbral (amarillo).
// - statusOk:       disponible >  mínimo           → stock saludable (verde).
// El resultado es una clase CSS que se aplica directamente a la celda de cantidad.
const stockStatus = (item) => {
  const disp = Number(item.cantidad_disponible);
  const min  = Number(item.cantidad_minima);
  if (disp <= min * 0.5) return styles.statusCritical;
  if (disp <= min)       return styles.statusLow;
  return styles.statusOk;
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de edición de inventario
// ─────────────────────────────────────────────────────────────────────────────
// Recibe el ítem completo del inventario como prop para pre-llenar el formulario.
// El campo "Producto" se muestra deshabilitado porque no es editable desde aquí;
// solo se pueden modificar las cantidades y la bodega asignada.
function InventarioModal({ item, bodegas, onClose, onSave }) {
  // Todos los valores se convierten a string para mantener coherencia con los
  // inputs controlados; handleUpdate los revertirá a Number antes del PUT.
  const [form, setForm] = useState({
    cantidad_disponible: String(item.cantidad_disponible ?? 0),
    cantidad_reservada:  String(item.cantidad_reservada  ?? 0),
    cantidad_minima:     String(item.cantidad_minima     ?? 0),
    bodega_id_bodega:    String(item.bodega_id_bodega    ?? ''),
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Delega la conversión de tipos y el PUT al padre (handleUpdate).
    onSave(form);
  };

  return (
    <Modal title='Editar Inventario' onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* El nombre del producto es solo informativo; no forma parte del payload */}
        <FormField label='Producto'>
          <Input value={item.nombre_producto ?? `Producto ${item.producto_id_producto}`} disabled />
        </FormField>

        <FormRow>
          <FormField label='Cantidad Disponible' required>
            <Input
              type='number' name='cantidad_disponible' min='0'
              value={form.cantidad_disponible} onChange={handleChange} required
            />
          </FormField>
          <FormField label='Cantidad Reservada'>
            <Input
              type='number' name='cantidad_reservada' min='0'
              value={form.cantidad_reservada} onChange={handleChange}
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Cantidad Mínima'>
            <Input
              type='number' name='cantidad_minima' min='0'
              value={form.cantidad_minima} onChange={handleChange}
            />
          </FormField>
          <FormField label='Bodega' required>
            <Select name='bodega_id_bodega' value={form.bodega_id_bodega} onChange={handleChange} required>
              <option value=''>Seleccionar bodega...</option>
              {bodegas.map((b) => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.descripcion} — {b.ciudad}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Cambios</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de stock crítico (Java / Tomcat)
// ─────────────────────────────────────────────────────────────────────────────
// Muestra los resultados devueltos por el servlet Java StockCriticoServlet.
// Maneja tres estados visuales distintos: cargando, error de conexión y tabla de datos.
// Los nombres de campo se leen con fallback (item.producto ?? item.nombre_producto)
// porque el servlet y el backend Node pueden devolver estructuras ligeramente distintas.
function StockCriticoModal({ data, loading, error, onClose }) {
  return (
    <Modal title='Stock Crítico (Java)' onClose={onClose} size='lg'>
      {loading && (
        <p className={styles.stockLoading}>Consultando servidor Java (Tomcat)...</p>
      )}
      {error && (
        <div className={styles.stockError}>{error}</div>
      )}
      {!loading && !error && data.length === 0 && (
        <p className={styles.stockEmpty}>No hay productos con stock crítico.</p>
      )}
      {!loading && !error && data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.stockTable}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Disponible</th>
                <th>Mínimo</th>
                <th>Déficit</th>
                <th>Bodega</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td className={styles.productName}>{item.producto ?? item.nombre_producto ?? '—'}</td>
                  <td>{item.disponible ?? item.cantidad_disponible ?? '—'}</td>
                  <td>{item.minimo ?? item.cantidad_minima ?? '—'}</td>
                  <td>
                    <span className={styles.deficitBadge}>
                      {item.deficit ?? item.deficit ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.bodegaBadge}>{item.bodega ?? item.descripcion_bodega ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Inventario() {
  const { isAdmin } = useRole();

  // `items` contiene el inventario completo; `bodegas` puebla el select del modal.
  const [items, setItems]     = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [search, setSearch]     = useState('');

  // `menuOpen` almacena el id_inventario del ítem cuyo menú ⋮ está visible, o null.
  const [menuOpen, setMenuOpen] = useState(null);

  // `editando` contiene el objeto completo del ítem que se está editando, o null.
  const [editando, setEditando] = useState(null);

  // Estados para la carga masiva desde Excel.
  const [importando, setImportando] = useState(false);
  // `importMsg` lleva { type: 'success' | 'warning' | 'error', text } para el banner.
  const [importMsg, setImportMsg]   = useState(null);

  // `confirmDelete` almacena el ítem pendiente de borrar para el banner de confirmación.
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Estados para el modal de stock crítico consultado al servlet Java.
  const [stockCriticoOpen, setStockCriticoOpen]       = useState(false);
  const [stockCriticoData, setStockCriticoData]       = useState([]);
  const [stockCriticoError, setStockCriticoError]     = useState(null);
  const [stockCriticoLoading, setStockCriticoLoading] = useState(false);

  // Referencia al input[type=file] oculto para activarlo programáticamente
  // desde el botón "Cargar Excel" sin mostrar el input nativo al usuario.
  const fileInputRef = useRef(null);

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // Solicita el inventario y las bodegas de forma independiente al montar.
  // Las bodegas se necesitan para el select del modal de edición.
  useEffect(() => {
    api.get('/inventario')
      .then(({ data }) => setItems(data))
      .catch(() => {});

    api.get('/bodegas')
      .then(({ data }) => setBodegas(data))
      .catch(() => {});
  }, []);

  // ── Cierre del menú de tres puntos al hacer clic fuera ───────────────────
  // El listener global de 'click' cierra cualquier menú abierto.
  // El botón ⋮ usa e.stopPropagation() para que el clic que lo abre no lo
  // cierre inmediatamente al llegar al document.
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ── Filtro de búsqueda en tiempo real ────────────────────────────────────
  // Filtra `items` en cada render según el texto de búsqueda.
  // Compara contra nombre del producto, ID de inventario y nombre de bodega;
  // no hay petición al servidor, todo el filtrado ocurre en el cliente.
  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      (item.nombre_producto    ?? '').toLowerCase().includes(q) ||
      String(item.id_inventario ?? '').includes(q) ||
      (item.descripcion_bodega  ?? '').toLowerCase().includes(q)
    );
  });

  // ── Exportar a Excel con SheetJS ─────────────────────────────────────────
  // Exporta únicamente las filas visibles tras el filtro (filtered), no el total.
  // Flujo:
  //  1. Construye un array de objetos planos con las cabeceras en español.
  //  2. XLSX.utils.json_to_sheet convierte el array a una hoja de cálculo.
  //  3. XLSX.utils.book_new crea un libro vacío y book_append_sheet añade la hoja.
  //  4. XLSX.writeFile dispara la descarga del archivo directamente en el navegador.
  // El nombre del archivo incluye la fecha actual para facilitar el archivo histórico.
  const handleExport = () => {
    const fecha = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const nombreArchivo = `reporte-inventario-${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}.xlsx`;

    const filas = filtered.map((item) => ({
      'ID':                    item.id_inventario,
      'Producto':              item.nombre_producto ?? '',
      'Bodega':                item.descripcion_bodega ?? '',
      'Cantidad Disponible':   item.cantidad_disponible,
      'Cantidad Reservada':    item.cantidad_reservada,
      'Cantidad Mínima':       item.cantidad_minima,
      'Última Actualización':  item.ultima_actualizacion
        ? new Date(item.ultima_actualizacion).toLocaleDateString('es-CO')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, nombreArchivo);
  };

  // ── Consultar stock crítico en el servlet Java ────────────────────────────
  // Abre el modal de inmediato en estado "cargando" y luego hace un fetch nativo
  // (no axios, porque el servlet corre en Tomcat puerto 8080, fuera del backend Node)
  // al endpoint StockCriticoServlet.
  // - TypeError indica que el servidor no está levantado o hay un problema de red.
  // - Cualquier otro error proviene de una respuesta HTTP no-ok del servlet.
  const handleStockCritico = async () => {
    setStockCriticoOpen(true);
    setStockCriticoLoading(true);
    setStockCriticoError(null);
    setStockCriticoData([]);
    try {
      const res = await fetch('http://localhost:8080/SIAPE-Servlets/StockCriticoServlet');
      if (!res.ok) throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
      const data = await res.json();
      // Garantiza que el estado sea siempre un array aunque el servlet devuelva un objeto.
      setStockCriticoData(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof TypeError) {
        setStockCriticoError('No se pudo conectar con el servidor Java (Tomcat). Verifique que esté en ejecución en el puerto 8080.');
      } else {
        setStockCriticoError(err.message || 'Error al consultar el stock crítico.');
      }
    } finally {
      setStockCriticoLoading(false);
    }
  };

  // ── Carga masiva desde Excel ──────────────────────────────────────────────
  // Se activa cuando el usuario selecciona un archivo en el input[type=file] oculto.
  // Flujo:
  //  1. file.arrayBuffer() lee el binario del archivo en memoria.
  //  2. XLSX.read parsea el buffer y devuelve un libro (wb).
  //  3. Se toma la primera hoja (wb.SheetNames[0]) y sheet_to_json la convierte en
  //     un array de objetos donde cada clave es el encabezado de columna del Excel.
  //     `cellDates: true` hace que las celdas de fecha lleguen como objetos Date.
  //  4. El array se envía al endpoint POST /inventario/carga-masiva del backend,
  //     que procesa cada fila y devuelve un resumen { creados, actualizados, errores }.
  //  5. Se recarga el inventario desde el servidor para reflejar los cambios.
  //  6. Se clasifica el resultado como 'success', 'warning' (parcial) o 'error'
  //     para mostrar el banner con el color adecuado.
  // e.target.value = '' limpia el input para que el mismo archivo pueda
  // volver a seleccionarse sin necesidad de recargar la página.
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setImportando(true);
    setImportMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(ws, { cellDates: true });

      if (filas.length === 0) {
        setImportMsg({ type: 'error', text: 'El archivo no contiene filas de datos.' });
        setImportando(false);
        return;
      }

      const { data } = await api.post('/inventario/carga-masiva', filas);
      const { creados, actualizados, errores } = data;

      // Recarga el inventario completo para reflejar los registros nuevos/actualizados.
      const { data: inv } = await api.get('/inventario');
      setItems(inv);

      const totalOk = creados + actualizados;
      if (errores.length === 0) {
        // Todas las filas se procesaron correctamente.
        setImportMsg({
          type: 'success',
          text: `Carga exitosa — ${creados} creado(s), ${actualizados} actualizado(s).`,
        });
      } else {
        // Algunas filas fallaron. Si ninguna fue exitosa el banner es rojo ('error');
        // si al menos una tuvo éxito es naranja ('warning').
        // Solo se muestran los primeros 3 errores para no saturar el banner;
        // si hay más se agrega '…' al final.
        const resumen = errores.slice(0, 3).join(' | ') + (errores.length > 3 ? '…' : '');
        setImportMsg({
          type: totalOk === 0 ? 'error' : 'warning',
          text: `${creados} creado(s), ${actualizados} actualizado(s), ${errores.length} con error: ${resumen}`,
        });
      }
    } catch (err) {
      setImportMsg({
        type: 'error',
        text: err.response?.data?.message || 'No se pudo procesar el archivo. Verifica que sea un Excel válido (.xlsx / .xls).',
      });
    } finally {
      setImportando(false);
    }
  };

  // ── Eliminación en dos pasos: inventario → producto ───────────────────────
  // Un registro de inventario tiene llave foránea al producto, por lo que primero
  // se elimina el registro de inventario y luego el producto asociado.
  // Invertir el orden causaría un error de integridad referencial en la base de datos.
  // Si cualquiera de las dos peticiones falla se muestra el error del backend;
  // en ese caso el ítem puede quedar en un estado parcialmente eliminado,
  // condición que el administrador debe resolver manualmente.
  const handleConfirmDelete = async () => {
    const item = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/inventario/${item.id_inventario}`);
      await api.delete(`/productos/${item.producto_id_producto}`);
      // Elimina el ítem del estado local sin recargar la lista completa.
      setItems((prev) => prev.filter((i) => i.id_inventario !== item.id_inventario));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Error al eliminar el producto o su inventario');
    }
  };

  // ── Guardar edición del inventario ────────────────────────────────────────
  // Convierte todos los campos a Number antes del PUT porque el formulario
  // los almacena como strings. `|| 0` previene NaN en campos opcionales vacíos.
  // Recarga el inventario completo tras la actualización para reflejar cambios
  // de otros campos que el backend pueda haber calculado (p. ej. ultima_actualizacion).
  const handleUpdate = async (form) => {
    try {
      await api.put(`/inventario/${editando.id_inventario}`, {
        cantidad_disponible: Number(form.cantidad_disponible),
        cantidad_reservada:  Number(form.cantidad_reservada)  || 0,
        cantidad_minima:     Number(form.cantidad_minima)     || 0,
        bodega_id_bodega:    Number(form.bodega_id_bodega),
      });
      const { data } = await api.get('/inventario');
      setItems(data);
      setEditando(null);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Error al actualizar inventario');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre, ID o bodega...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          {/* Exporta el listado filtrado actual a un .xlsx con SheetJS */}
          <button className={styles.btnOutline} onClick={handleExport}>📄 Exportar Reporte</button>

          {/*
            El input[type=file] está oculto con display:none para evitar el aspecto
            nativo del navegador. El botón "Cargar Excel" lo activa mediante
            fileInputRef.current.click(), lo que abre el diálogo del sistema operativo.
            `accept` restringe la selección a archivos .xlsx y .xls.
            Durante la importación el botón se deshabilita para evitar envíos dobles.
          */}
          <input
            ref={fileInputRef}
            type='file'
            accept='.xlsx,.xls'
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            className={styles.btnOutline}
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
          >
            {importando ? 'Importando...' : '📂 Cargar Excel'}
          </button>

          {/* Consulta el servlet Java StockCriticoServlet en Tomcat :8080 */}
          <button
            className={styles.btnJava}
            onClick={handleStockCritico}
            disabled={stockCriticoLoading}
          >
            {stockCriticoLoading ? 'Consultando...' : '☕ Stock Crítico (Java)'}
          </button>
        </div>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Flujo: clic en "Eliminar" en el menú ⋮ → setConfirmDelete(item) → aparece
          este banner → "Confirmar" ejecuta handleConfirmDelete (primero inventario,
          luego producto) → "Cancelar" descarta sin borrar nada. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el producto <strong>{confirmDelete.nombre_producto ?? confirmDelete.producto_id_producto}</strong> y su inventario? Esta acción no se puede deshacer.</span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>Confirmar</button>
          </div>
        </div>
      )}

      {/* ── Banner de resultado de la importación ────────────────────────────
          Se muestra después de procesar un Excel. El color varía según `importMsg.type`:
          - success  → verde: todas las filas procesadas correctamente.
          - warning  → naranja: algunas filas fallaron pero otras tuvieron éxito.
          - error    → rojo: ninguna fila procesada o error de parseo del archivo.
          El botón ✕ lo cierra manualmente. */}
      {importMsg && (
        <div className={`${styles.importBanner} ${styles[`importBanner_${importMsg.type}`]}`}>
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} className={styles.importBannerClose}>✕</button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Bodega</th>
              <th>Cant. Disponible</th>
              <th>Cant. Reservada</th>
              <th>Cant. Mínima</th>
              <th>Última Actualización</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id_inventario}>
                <td className={styles.mono}>{item.id_inventario}</td>
                <td className={styles.productName}>{item.nombre_producto ?? '—'}</td>
                <td>
                  <span className={styles.bodegaBadge}>
                    {item.descripcion_bodega ?? `Bodega ${item.bodega_id_bodega}`}
                  </span>
                </td>
                <td>
                  {/* stockStatus colorea la celda según si el stock supera,
                      roza o está por debajo del 50 % del mínimo configurado */}
                  <span className={`${styles.qty} ${stockStatus(item)}`}>
                    {item.cantidad_disponible}
                  </span>
                </td>
                <td>{item.cantidad_reservada}</td>
                <td>{item.cantidad_minima}</td>
                <td>{formatDate(item.ultima_actualizacion)}</td>
                <td className={styles.menuCell}>
                  {/* Menú de tres puntos: solo visible para administradores.
                      e.stopPropagation() impide que el listener global de click
                      cierre el menú en el mismo evento que lo abre. */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === item.id_inventario ? null : item.id_inventario); }}
                      >⋮</button>
                      {menuOpen === item.id_inventario && (
                        <div className={styles.dropdown}>
                          <button onClick={() => { setEditando(item); setMenuOpen(null); }}>✏️ Editar</button>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(item); setMenuOpen(null); }}
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
          <p className={styles.empty}>No se encontraron productos.</p>
        )}
      </div>

      {/* El modal se monta cuando `editando` tiene un ítem; al cerrar se pone a null
          y el estado interno del formulario se destruye automáticamente. */}
      {editando && (
        <InventarioModal
          item={editando}
          bodegas={bodegas}
          onClose={() => setEditando(null)}
          onSave={handleUpdate}
        />
      )}

      {stockCriticoOpen && (
        <StockCriticoModal
          data={stockCriticoData}
          loading={stockCriticoLoading}
          error={stockCriticoError}
          onClose={() => setStockCriticoOpen(false)}
        />
      )}
    </div>
  );
}

export default Inventario;
