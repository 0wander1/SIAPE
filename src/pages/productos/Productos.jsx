// Página de gestión de productos. Lista todos los productos con búsqueda en tiempo
// real y permite a los administradores crear, editar y eliminar productos.
// Al crear un producto el backend genera automáticamente su registro de inventario.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Productos.module.css';

// Valores iniciales del formulario en modo creación. Se define fuera del componente
// para que no se recree en cada render y pueda usarse como referencia estable.
const emptyForm = {
  nombre_producto:   '',
  valor_neto:        '',
  valor_de_venta:    '',
  lote:              '',
  fecha_vencimiento: '',
  bodega_id_bodega:  '',
  // Campos exclusivos de creación: el backend los usa para generar el registro
  // de inventario inicial junto con el producto en la misma operación.
  cantidad:          '',
  cantidad_minima:   '0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de producto
// ─────────────────────────────────────────────────────────────────────────────
function ProductoModal({ onClose, onSave, bodegas, initialData }) {
  // `isEdit` distingue los dos modos del modal.
  // En edición, `initialData` contiene los valores normalizados por openEdit();
  // en creación, el formulario parte de emptyForm.
  const isEdit = !!initialData;
  const [form, setForm] = useState(initialData ?? emptyForm);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Delega la construcción del payload y la llamada a la API al componente padre.
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'Editar Producto' : 'Agregar Producto'} onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Nombre del Producto' required>
          <Input
            name='nombre_producto'
            value={form.nombre_producto}
            onChange={handleChange}
            placeholder='Ej: Leche Entera 1L'
            required
          />
        </FormField>

        <FormRow>
          <FormField label='Valor Neto' required>
            <Input
              type='number'
              name='valor_neto'
              value={form.valor_neto}
              onChange={handleChange}
              placeholder='0'
              min='0'
              required
            />
          </FormField>
          <FormField label='Valor de Venta' required>
            <Input
              type='number'
              name='valor_de_venta'
              value={form.valor_de_venta}
              onChange={handleChange}
              placeholder='0'
              min='0'
              required
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Lote'>
            <Input
              name='lote'
              value={form.lote}
              onChange={handleChange}
              placeholder='Ej: LOTE-2026-001'
            />
          </FormField>
          <FormField label='Fecha de Vencimiento'>
            <Input
              type='date'
              name='fecha_vencimiento'
              value={form.fecha_vencimiento}
              onChange={handleChange}
            />
          </FormField>
        </FormRow>

        {/*
          Los campos de cantidad solo se muestran en modo creación (!isEdit).
          En edición ya existe un registro de inventario para ese producto;
          modificar su stock se hace desde la página de Inventario, no desde aquí.
          En creación, estos valores se envían al backend junto con los datos del
          producto para que cree el registro de inventario inicial en una sola
          transacción, evitando productos sin inventario asociado.
        */}
        {!isEdit && (
          <FormRow>
            <FormField label='Cantidad Disponible' required>
              <Input
                type='number'
                name='cantidad'
                value={form.cantidad}
                onChange={handleChange}
                placeholder='0'
                min='0'
                required
              />
            </FormField>
            <FormField label='Cantidad Mínima'>
              <Input
                type='number'
                name='cantidad_minima'
                value={form.cantidad_minima}
                onChange={handleChange}
                placeholder='0'
                min='0'
              />
            </FormField>
          </FormRow>
        )}

        <FormField label='Bodega' required>
          <Select
            name='bodega_id_bodega'
            value={form.bodega_id_bodega}
            onChange={handleChange}
            required
          >
            <option value=''>Seleccionar bodega...</option>
            {bodegas.map((b) => (
              <option key={b.id_bodega} value={b.id_bodega}>
                {b.descripcion} — {b.ciudad}
              </option>
            ))}
          </Select>
        </FormField>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Guardar Cambios' : 'Guardar Producto'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Productos() {
  const { isAdmin } = useRole();

  const [productos, setProductos] = useState([]);
  // `bodegas` se carga al montar para poblar el select del modal.
  const [bodegas, setBodegas]     = useState([]);
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);

  // `menuOpen` guarda el id_producto del menú ⋮ abierto, o null si ninguno.
  const [menuOpen, setMenuOpen]       = useState(null);
  // `errorMsg` alimenta el banner de error rojo con auto-cierre.
  const [errorMsg, setErrorMsg]       = useState('');
  // `confirmDelete` almacena el producto pendiente de eliminar.
  const [confirmDelete, setConfirmDelete] = useState(null);
  // `editando` guarda el id_producto que se está editando (null en creación).
  const [editando, setEditando]       = useState(null);
  // `initialData` contiene los valores normalizados para pre-llenar el formulario.
  const [initialData, setInitialData] = useState(null);

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // Productos y bodegas se solicitan en paralelo al montar el componente.
  // El array vacío [] garantiza que solo se ejecute una vez; no hay dependencias
  // que requieran recargar estos recursos automáticamente.
  useEffect(() => {
    api.get('/productos')
      .then(({ data }) => setProductos(data))
      .catch(() => {});

    api.get('/bodegas')
      .then(({ data }) => setBodegas(data))
      .catch(() => {});
  }, []);

  // ── Filtro de búsqueda en tiempo real ────────────────────────────────────
  // Filtra en cliente sobre nombre del producto y número de lote.
  // No genera peticiones al servidor; opera sobre el array ya cargado.
  const filtered = productos.filter((p) =>
    (p.nombre_producto ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.lote ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Cierra el modal y limpia el estado de edición para que la siguiente apertura
  // del modal parta siempre en modo creación con formulario vacío.
  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

  // Normaliza los valores del producto antes de pasarlos como estado inicial al modal:
  // - Convierte precios a string para los inputs controlados.
  // - Trunca la fecha ISO a YYYY-MM-DD para que el input type='date' la acepte.
  // - Excluye cantidad y cantidad_minima porque en edición esos campos no se muestran.
  const openEdit = (p) => {
    setInitialData({
      nombre_producto:   p.nombre_producto ?? '',
      valor_neto:        String(p.valor_neto ?? 0),
      valor_de_venta:    String(p.valor_de_venta ?? 0),
      lote:              p.lote ?? '',
      fecha_vencimiento: p.fecha_vencimiento?.slice(0, 10) ?? '',
      bodega_id_bodega:  String(p.bodega_id_bodega ?? ''),
    });
    setEditando(p.id_producto);
    setMenuOpen(null);
    setShowModal(true);
  };

  // ── Guardar producto (crear o editar) ─────────────────────────────────────
  const handleSave = async (form) => {
    // Payload base compartido por creación y edición.
    // Los campos opcionales (lote, fecha_vencimiento) se envían como null si están
    // vacíos para que el backend no los trate como strings vacíos.
    const payload = {
      nombre_producto:   form.nombre_producto,
      valor_neto:        Number(form.valor_neto),
      valor_de_venta:    Number(form.valor_de_venta),
      lote:              form.lote || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      bodega_id_bodega:  Number(form.bodega_id_bodega),
    };

    try {
      if (editando) {
        // En edición solo se actualiza el producto; el inventario se gestiona
        // desde la página de Inventario.
        await api.put(`/productos/${editando}`, payload);
      } else {
        // En creación se añaden cantidad y cantidad_minima al payload.
        // El backend recibe estos dos valores adicionales y los usa para crear
        // el registro de inventario inicial vinculado al nuevo producto,
        // de forma que nunca exista un producto sin su fila de inventario.
        await api.post('/productos', {
          ...payload,
          cantidad:        Number(form.cantidad),
          cantidad_minima: Number(form.cantidad_minima) || 0,
        });
      }
      // Recarga la lista completa desde el servidor para reflejar el nuevo
      // producto con su ID generado y los campos calculados por el backend.
      const { data } = await api.get('/productos');
      setProductos(data);
      closeModal();
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || `Error al ${editando ? 'editar' : 'crear'} producto`;
      // Muestra el banner de error y lo auto-cierra a los 4 segundos.
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // ── Eliminación con validación de pedidos asociados ───────────────────────
  // Se llama únicamente cuando el usuario confirma en el banner de confirmación.
  // Si el producto tiene pedidos activos vinculados, el backend rechaza la
  // eliminación por integridad referencial y devuelve un mensaje explicativo
  // en error.response.data.message, que se muestra en el banner de error rojo.
  // Si la eliminación tiene éxito, el producto se quita del estado local
  // sin necesidad de recargar la lista completa desde el servidor.
  const handleConfirmDelete = async () => {
    const p = confirmDelete;
    // Cierra el banner de confirmación antes del request para evitar doble clic.
    setConfirmDelete(null);
    try {
      await api.delete(`/productos/${p.id_producto}`);
      setProductos((prev) => prev.filter((x) => x.id_producto !== p.id_producto));
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar el producto';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Resuelve el nombre descriptivo de la bodega a partir de su ID.
  // Se usa en la tabla porque el backend devuelve el ID numérico, no el nombre.
  const bodegaLabel = (id) => {
    const b = bodegas.find((b) => b.id_bodega === id);
    return b ? b.descripcion : `Bodega ${id}`;
  };

  return (
    <div className={styles.page}>
      {/*
        Banner de error rojo con auto-cierre.
        Se monta cuando `errorMsg` tiene contenido y se desmonta cuando se vacía.
        Puede aparecer en dos situaciones:
          1. El backend rechaza la eliminación porque el producto tiene pedidos asociados.
          2. Falla la creación o edición del producto (validación server-side, red, etc.).
        El botón ✕ permite cerrarlo antes del auto-cierre de 4 segundos.
        Los estilos están inline (no en el módulo CSS) para mantener este banner
        visualmente diferenciado del banner naranja de confirmación.
      */}
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

      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Productos</h2>
        <p className={styles.pageSubtitle}>Gestión de productos</p>
      </div>

      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre o lote...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Asegura que al abrir el modal en modo creación no queden residuos
            de una edición previa en editando/initialData. */}
        <button className={styles.btnNew} onClick={() => { setEditando(null); setInitialData(null); setShowModal(true); }}>
          + Agregar Producto
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Flujo: clic en "Eliminar" del menú ⋮ → setConfirmDelete(p) → aparece
          este banner → "Confirmar" llama a handleConfirmDelete → "Cancelar"
          limpia confirmDelete sin ejecutar ninguna petición. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el producto <strong>{confirmDelete.nombre_producto}</strong>? Esta acción no se puede deshacer.</span>
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
              <th>ID Producto</th>
              <th>Nombre</th>
              <th>Valor Neto</th>
              <th>Valor de Venta</th>
              <th>Lote</th>
              <th>Fecha Vencimiento</th>
              <th>Bodega</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id_producto}>
                <td className={styles.mono}>{p.id_producto}</td>
                <td className={styles.productName}>{p.nombre_producto}</td>
                <td>
                  <span className={styles.priceBadge}>{formatCOP(p.valor_neto)}</span>
                </td>
                <td>
                  <span className={styles.priceBadge}>{formatCOP(p.valor_de_venta)}</span>
                </td>
                <td>
                  {p.lote ? (
                    <span className={styles.loteBadge}>{p.lote}</span>
                  ) : '-'}
                </td>
                <td>{formatDate(p.fecha_vencimiento)}</td>
                <td>
                  <span className={styles.bodegaBadge}>{bodegaLabel(p.bodega_id_bodega)}</span>
                </td>
                <td className={styles.menuCell}>
                  {/* Menú de tres puntos exclusivo para administradores.
                      El toggle usa `menuOpen === p.id_producto` para alternar:
                      si el menú de este producto ya está abierto lo cierra,
                      si está cerrado lo abre (y cierra cualquier otro implícitamente
                      porque menuOpen solo puede tener un valor a la vez). */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={() => setMenuOpen(menuOpen === p.id_producto ? null : p.id_producto)}
                      >
                        ⋮
                      </button>
                      {menuOpen === p.id_producto && (
                        <div className={styles.dropdown}>
                          <button onClick={() => openEdit(p)}>✏️ Editar</button>
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
          <p className={styles.empty}>No se encontraron productos.</p>
        )}
      </div>

      {/* El modal se monta condicionalmente para que al cerrarlo su estado
          interno se destruya y la próxima apertura parta siempre de cero. */}
      {showModal && (
        <ProductoModal
          onClose={closeModal}
          onSave={handleSave}
          bodegas={bodegas}
          initialData={initialData}
        />
      )}
    </div>
  );
}

export default Productos;
