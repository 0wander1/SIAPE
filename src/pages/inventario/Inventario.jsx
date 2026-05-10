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

const stockStatus = (item) => {
  const disp = Number(item.cantidad_disponible);
  const min  = Number(item.cantidad_minima);
  if (disp <= min * 0.5) return styles.statusCritical;
  if (disp <= min)       return styles.statusLow;
  return styles.statusOk;
};

function InventarioModal({ item, bodegas, onClose, onSave }) {
  const [form, setForm] = useState({
    cantidad_disponible: String(item.cantidad_disponible ?? 0),
    cantidad_reservada:  String(item.cantidad_reservada  ?? 0),
    cantidad_minima:     String(item.cantidad_minima     ?? 0),
    bodega_id_bodega:    String(item.bodega_id_bodega    ?? ''),
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title='Editar Inventario' onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

function Inventario() {
  const { isAdmin } = useRole();
  const [items, setItems] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);
  const [editando, setEditando] = useState(null);
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [stockCriticoOpen, setStockCriticoOpen] = useState(false);
  const [stockCriticoData, setStockCriticoData] = useState([]);
  const [stockCriticoError, setStockCriticoError] = useState(null);
  const [stockCriticoLoading, setStockCriticoLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/inventario')
      .then(({ data }) => setItems(data))
      .catch(() => {});

    api.get('/bodegas')
      .then(({ data }) => setBodegas(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      (item.nombre_producto ?? '').toLowerCase().includes(q) ||
      String(item.id_inventario ?? '').includes(q) ||
      (item.descripcion_bodega ?? '').toLowerCase().includes(q)
    );
  });

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

  const handleStockCritico = async () => {
    setStockCriticoOpen(true);
    setStockCriticoLoading(true);
    setStockCriticoError(null);
    setStockCriticoData([]);
    try {
      const res = await fetch('http://localhost:8080/SIAPE-Servlets/StockCriticoServlet');
      if (!res.ok) throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
      const data = await res.json();
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

      const { data: inv } = await api.get('/inventario');
      setItems(inv);

      const totalOk = creados + actualizados;
      if (errores.length === 0) {
        setImportMsg({
          type: 'success',
          text: `Carga exitosa — ${creados} creado(s), ${actualizados} actualizado(s).`,
        });
      } else {
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

  const handleConfirmDelete = async () => {
    const item = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/inventario/${item.id_inventario}`);
      await api.delete(`/productos/${item.producto_id_producto}`);
      setItems((prev) => prev.filter((i) => i.id_inventario !== item.id_inventario));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Error al eliminar el producto o su inventario');
    }
  };

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
          <button className={styles.btnOutline} onClick={handleExport}>📄 Exportar Reporte</button>
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
          <button
            className={styles.btnJava}
            onClick={handleStockCritico}
            disabled={stockCriticoLoading}
          >
            {stockCriticoLoading ? 'Consultando...' : '☕ Stock Crítico (Java)'}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el producto <strong>{confirmDelete.nombre_producto ?? confirmDelete.producto_id_producto}</strong> y su inventario? Esta acción no se puede deshacer.</span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>Confirmar</button>
          </div>
        </div>
      )}

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
                  <span className={`${styles.qty} ${stockStatus(item)}`}>
                    {item.cantidad_disponible}
                  </span>
                </td>
                <td>{item.cantidad_reservada}</td>
                <td>{item.cantidad_minima}</td>
                <td>{formatDate(item.ultima_actualizacion)}</td>
                <td className={styles.menuCell}>
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
