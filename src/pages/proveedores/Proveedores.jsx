// Página de gestión de proveedores. Lista todos los proveedores con búsqueda
// por nombre o NIT y permite a los administradores crearlos, editarlos y eliminarlos.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockProveedores, mockTrabajadores, mockInventario } from '../../utils/mockData.js';
import { formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Proveedores.module.css';

// Valores iniciales del formulario en modo creación.
// Se define fuera del componente para que sea una referencia estable.
const emptyForm = {
  nombre: '', nit: '', trabajador: '', productos: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de proveedor
// ─────────────────────────────────────────────────────────────────────────────
// `nitError` se recibe como prop desde el padre en lugar de manejarse con estado
// interno, porque el error se genera en `handleSave` (fuera del modal) al detectar
// el HTTP 409 del backend. Así el modal puede mostrarlo sin necesidad de
// mecanismos de comunicación hijo→padre adicionales.
function ProveedorModal({ onClose, onSave, trabajadores, inventario, nitError, initialData, isEdit }) {
  // En edición, `initialData` contiene los valores normalizados por openEdit().
  // En creación, el formulario parte de emptyForm.
  // `productos` es un array de nombres de producto (strings), no de IDs.
  const [form, setForm] = useState(initialData ?? emptyForm);

  // Estado local del selector de producto antes de añadirlo a la lista.
  const [productoSel, setProductoSel] = useState('');

  // Añade el producto seleccionado al array form.productos.
  // Evita duplicados comprobando si el nombre ya está en el array antes de agregarlo.
  const addProducto = () => {
    if (!productoSel || form.productos.includes(productoSel)) return;
    setForm({ ...form, productos: [...form.productos, productoSel] });
    setProductoSel('');
  };

  // Elimina un producto de la lista filtrando por nombre.
  const removeProducto = (p) => {
    setForm({ ...form, productos: form.productos.filter((x) => x !== p) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Delega la lógica de POST/PUT y la validación de NIT al padre.
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'Editar Proveedor' : 'Agregar Proveedor'} onClose={onClose} size='md'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/*
          Banner de error de NIT duplicado dentro del modal.
          Se renderiza solo cuando el padre tiene un `nitError` activo (HTTP 409).
          Al estar dentro del modal y no en la página, el usuario ve el error
          justo encima del campo que lo causó, sin perder el contexto del formulario.
          Los estilos son inline para mantenerlo independiente del módulo CSS de la página.
        */}
        {nitError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 14 }}>
            {nitError}
          </div>
        )}

        <FormField label='Nombre del Proveedor' required>
          <Input
            name='nombre' value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder='Razón social' required
          />
        </FormField>

        <FormRow>
          <FormField label='NIT' required>
            <Input
              name='nit' value={form.nit}
              onChange={(e) => setForm({ ...form, nit: e.target.value })}
              placeholder='900000000-0' required
            />
          </FormField>
          <FormField label='Trabajador Responsable'>
            <Select
              value={form.trabajador}
              onChange={(e) => setForm({ ...form, trabajador: e.target.value })}
            >
              <option value=''>Seleccionar...</option>
              {trabajadores.map((t) => (
                <option key={t.id ?? t.id_usuario_trab} value={t.id ?? t.id_usuario_trab}>
                  {t.nombre ?? t.user_name}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        {/*
          Sección de productos asociados al proveedor.
          El select usa el nombre del producto como valor (no el ID) porque la API
          de proveedores recibe un array de nombres de productos para asociarlos.
          addProducto previene duplicados; cada tag muestra el nombre del producto
          con un botón ✕ para quitarlo de la lista antes de guardar.
        */}
        <div className={styles.productosSection}>
          <p className={styles.sectionLabel}>Productos Asociados</p>
          <div className={styles.addProductRow}>
            <Select
              value={productoSel}
              onChange={(e) => setProductoSel(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value=''>Seleccionar producto...</option>
              {inventario.map((p) => (
                <option key={p.id_producto ?? p.id} value={p.nombre_producto ?? p.nombre}>
                  {p.nombre_producto ?? p.nombre}
                </option>
              ))}
            </Select>
            <button type='button' className={styles.btnAddProd} onClick={addProducto}>
              + Agregar Producto
            </button>
          </div>
          {form.productos.length > 0 && (
            <div className={styles.productosList}>
              {form.productos.map((p) => (
                <span key={p} className={styles.productoTag}>
                  {p}
                  <button type='button' onClick={() => removeProducto(p)}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Actualizar Proveedor' : 'Guardar Proveedor'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Proveedores() {
  const { isAdmin } = useRole();

  const [proveedores, setProveedores] = useState([]);

  // `trabajadores` e `inventario` se inicializan con datos mock para que los
  // selects del modal tengan opciones mientras llegan las respuestas de la API.
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);
  const [inventario, setInventario]     = useState(mockInventario);

  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);

  // `menuOpen` guarda el id_proveedor del menú ⋮ abierto, o null si ninguno.
  const [menuOpen, setMenuOpen] = useState(null);

  // `nitError` contiene el mensaje de error cuando el backend devuelve HTTP 409
  // por NIT duplicado. Se pasa como prop al modal para mostrarse dentro de él.
  const [nitError, setNitError] = useState('');

  // `editando` guarda el id_proveedor que se está editando (null en creación).
  const [editando, setEditando]       = useState(null);
  // `initialData` contiene los valores normalizados para pre-llenar el formulario.
  const [initialData, setInitialData] = useState(null);

  // `confirmDelete` almacena el proveedor pendiente de eliminar.
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // Los tres recursos se solicitan en paralelo al montar el componente.
  // - proveedores: lista principal de la tabla.
  // - trabajadores: opciones del select "Trabajador Responsable" en el modal.
  // - productos: opciones del selector de productos asociados en el modal.
  // Cada catch vacío preserva los datos mock si el endpoint no está disponible.
  useEffect(() => {
    api.get('/proveedores')
      .then(({ data }) => { console.log('[Proveedores] GET /proveedores:', data); setProveedores(data); })
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});

    api.get('/productos')
      .then(({ data }) => setInventario(data))
      .catch(() => {});
  }, []);

  // ── Filtro de búsqueda en tiempo real ────────────────────────────────────
  // Opera sobre el array en memoria sin peticiones al servidor.
  // Compara contra nombre del proveedor (ignorando mayúsculas) y NIT
  // (comparación directa de string, ya que el NIT es un código sin variantes de caso).
  const filtered = proveedores.filter(
    (p) =>
      (p.nombre_proveedor ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.NIT ?? '').includes(search)
  );

  // Normaliza los datos del proveedor para pre-llenar el formulario en edición:
  // - Convierte id_usuario_trab a string para el value del <select>.
  // - Resuelve los IDs de productos_asociados a nombres buscando en `inventario`,
  //   porque el formulario trabaja con nombres (no IDs) en el array de productos.
  //   Si un ID no tiene match en inventario se usa el ID como fallback.
  // - Limpia nitError para que no aparezca un error previo al abrir el modal.
  const openEdit = (p) => {
    setInitialData({
      nombre:     p.nombre_proveedor,
      nit:        p.NIT,
      trabajador: String(p.id_usuario_trab ?? ''),
      productos:  (p.productos_asociados ?? []).map((pa) => {
        const prod = inventario.find((i) => (i.id_producto ?? i.id) == pa.producto_id_producto);
        return prod ? (prod.nombre_producto ?? prod.nombre) : String(pa.producto_id_producto);
      }),
    });
    setEditando(p.id_proveedor);
    setNitError('');
    setMenuOpen(null);
    setShowModal(true);
  };

  // Cierra el modal y limpia todo el estado asociado a la operación en curso,
  // incluido nitError, para que no persista en la próxima apertura del modal.
  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
    setNitError('');
  };

  // ── Eliminación con confirmación ──────────────────────────────────────────
  // Se invoca solo cuando el usuario confirma en el banner.
  // 1. Cierra el banner inmediatamente para evitar doble clic.
  // 2. Envía DELETE /proveedores/:id.
  // 3. Si tiene éxito, elimina el proveedor del estado local sin recargar la lista.
  // 4. Si falla (p. ej. relaciones activas en la base de datos), muestra el
  //    mensaje del backend en un alert nativo.
  const handleConfirmDelete = async () => {
    const p = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/proveedores/${p.id_proveedor}`);
      setProveedores((prev) => prev.filter((x) => x.id_proveedor !== p.id_proveedor));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'No se pudo eliminar el proveedor.');
    }
  };

  // ── Guardar proveedor (crear o editar) ────────────────────────────────────
  const handleSave = async (form) => {
    setNitError('');
    try {
      if (editando) {
        await api.put(`/proveedores/${editando}`, {
          nombre_proveedor: form.nombre,
          NIT:              form.nit,
          id_usuario_trab:  Number(form.trabajador) || null,
        });
      } else {
        await api.post('/proveedores', {
          nombre_proveedor: form.nombre,
          NIT:              form.nit,
          id_usuario_trab:  Number(form.trabajador) || null,
        });
      }
      // Recarga la lista completa para reflejar los cambios con datos del servidor.
      const { data } = await api.get('/proveedores');
      setProveedores(data);
      closeModal();
    } catch (error) {
      // Validación de NIT duplicado:
      // El backend devuelve HTTP 409 (Conflict) cuando ya existe un proveedor con
      // el mismo NIT. En ese caso se actualiza `nitError` con el mensaje de error,
      // que el modal muestra en el banner rojo interno SIN cerrarse, permitiendo
      // al usuario corregir el NIT sin perder el resto del formulario.
      // Para cualquier otro error se cierra el modal (comportamiento genérico de fallo).
      if (error.response?.status === 409) {
        setNitError('Ya existe un proveedor con ese NIT.');
      } else {
        closeModal();
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre o NIT...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Proveedor
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Se monta cuando `confirmDelete` tiene un proveedor pendiente.
          "Confirmar" ejecuta handleConfirmDelete; "Cancelar" limpia
          confirmDelete sin enviar ninguna petición. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el proveedor <strong>{confirmDelete.nombre_proveedor}</strong>? Esta acción no se puede deshacer.</span>
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
              <th>Nombre</th>
              <th>NIT</th>
              <th>Pedidos por Entregar</th>
              <th>Fecha Pedido Pendiente</th>
              <th>ID Usuario</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id_proveedor}>
                <td className={styles.mono}>{p.id_proveedor}</td>
                <td className={styles.nombre}>{p.nombre_proveedor}</td>
                <td className={styles.mono}>{p.NIT}</td>
                <td>
                  {/* Badge azul si tiene productos asociados, gris si no tiene ninguno */}
                  <span className={(p.productos_asociados?.length ?? 0) > 0 ? styles.badgeBlue : styles.badgeGray}>
                    {p.productos_asociados?.length ?? 0}
                  </span>
                </td>
                <td>-</td>
                <td>{p.id_usuario_trab ?? '-'}</td>
                <td className={styles.menuCell}>
                  {/*
                    Menú de tres puntos exclusivo para administradores.
                    A diferencia de otras páginas, este componente no registra un
                    listener global de 'click' para click-outside; el menú se cierra
                    cuando el usuario hace clic en otra fila (el toggle reemplaza
                    menuOpen con el nuevo ID) o cuando elige una acción del dropdown
                    (setMenuOpen(null) explícito). El botón ⋮ alterna el menú del
                    proveedor actual: si ya está abierto lo cierra, si no lo abre.
                  */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={() => setMenuOpen(menuOpen === p.id_proveedor ? null : p.id_proveedor)}
                      >⋮</button>
                      {menuOpen === p.id_proveedor && (
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
          <p className={styles.empty}>No se encontraron proveedores.</p>
        )}
      </div>

      {/* El modal se monta condicionalmente. `isEdit` se pasa como prop derivado
          de `editando` para que el modal conozca su modo sin recibir el ID. */}
      {showModal && (
        <ProveedorModal
          onClose={closeModal}
          onSave={handleSave}
          trabajadores={trabajadores}
          inventario={inventario}
          nitError={nitError}
          initialData={initialData}
          isEdit={!!editando}
        />
      )}
    </div>
  );
}

export default Proveedores;
