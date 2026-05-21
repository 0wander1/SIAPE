// Página de gestión de facturas. Soporta dos modos de creación:
// - Factura vinculada a un pedido existente: el subtotal se ingresa manualmente.
// - Venta directa (sin pedido): el subtotal se calcula automáticamente a partir
//   de los productos y cantidades que el usuario agrega como líneas de detalle.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockFacturas, mockPedidos, mockTrabajadores } from '../../utils/mockData.js';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Facturas.module.css';

// Resuelve la clase CSS del badge de estado de una factura.
const estadoClass = (estado) => {
  const map = {
    'emitida': styles.badgePending,
    'pagada':  styles.badgePaid,
    'vencida': styles.badgeOverdue,
    'anulada': styles.badgeDraft,
    'parcial': styles.badgeDraft,
  };
  return map[estado] || styles.badgeDraft;
};

// Crea un ítem de línea vacío para la lista de productos en venta directa.
// `_key` es un identificador único interno generado con Date.now() + Math.random()
// para evitar colisiones de key si el usuario agrega varios ítems muy rápido.
// No se envía al backend; solo se usa como key de React y para localizar el ítem
// en las operaciones de updateItem / removeItem.
const itemVacio = () => ({ _key: Date.now() + Math.random(), producto_id: '', cantidad: '', busqueda: '' });

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de factura
// ─────────────────────────────────────────────────────────────────────────────
// Recibe `pedidoError` como prop desde el padre (igual que `nitError` en
// Proveedores) porque el error se genera en `handleSave` al detectar HTTP 409;
// de esta forma el modal puede mostrarlo sin estado ni callbacks adicionales.
function FacturaModal({ onClose, onSave, pedidos, trabajadores, nextNum, initialData, pedidoError }) {
  // El número de factura se pre-rellena con el siguiente correlativo sugerido.
  // `nextNum` viene del padre como `facturas.length + 1`, garantizando que el
  // número sea único por defecto sin que el usuario tenga que calcularlo.
  const [form, setForm] = useState(initialData ?? {
    numeroFactura:    `F-2026-${String(nextNum).padStart(3, '0')}`,
    idPedido:         '',
    fechaEmision:     '',
    fechaVencimiento: '',
    subtotal:         '',
    impuesto:         19,
    descuento:        0,
    estado:           'emitida',
    trabajador:       '',
  });

  // `productos` se carga dentro del modal porque solo se necesita en el modo
  // de venta directa; cargarlo en el padre sería prematuro.
  const [productos, setProductos] = useState([]);

  // `items` es el array de líneas de producto para venta directa.
  // Arranca con un ítem vacío para que el usuario no tenga que pulsar "+ Agregar".
  const [items, setItems] = useState([itemVacio()]);

  // Carga el catálogo de productos al montar el modal.
  useEffect(() => {
    api.get('/productos')
      .then(({ data }) => setProductos(data ?? []))
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // Añade una nueva línea de producto vacía al final del array.
  const addItem = () => setItems((prev) => [...prev, itemVacio()]);

  // Elimina la línea identificada por `_key` del array de ítems.
  const removeItem = (key) => setItems((prev) => prev.filter((i) => i._key !== key));

  // Actualiza un campo específico de la línea identificada por `_key`.
  // Cada línea gestiona su propio campo `busqueda` (para el filtro de búsqueda)
  // y sus campos `producto_id` y `cantidad` de forma independiente.
  const updateItem = (key, field, value) =>
    setItems((prev) => prev.map((i) => (i._key === key ? { ...i, [field]: value } : i)));

  // ── Cálculo automático del subtotal (venta directa) ──────────────────────
  // Recorre todas las líneas de producto y acumula:
  //   valor_de_venta del producto × cantidad ingresada
  // Solo se usa cuando no hay pedido asociado (form.idPedido vacío).
  // Si el producto no está seleccionado o la cantidad es 0, aporta 0 al acumulado.
  const subtotalItems = items.reduce((acc, item) => {
    const prod = productos.find((p) => String(p.id_producto) === String(item.producto_id));
    return acc + (Number(prod?.valor_de_venta) || 0) * (Number(item.cantidad) || 0);
  }, 0);

  // `subtotalBase` determina qué valor se usa para calcular impuesto y total:
  // - Con pedido asociado: se usa el subtotal ingresado manualmente por el usuario
  //   (el campo es editable porque el pedido ya tiene su propio valor).
  // - Sin pedido (venta directa): se usa el subtotal calculado automáticamente
  //   a partir de los ítems (el campo se muestra deshabilitado).
  const subtotalBase = form.idPedido ? Number(form.subtotal) || 0 : subtotalItems;

  // Impuesto y total se recalculan en cada render a partir de subtotalBase.
  // Math.round elimina centavos fraccionados del impuesto.
  const impuestoAmt = Math.round(subtotalBase * (Number(form.impuesto) / 100));
  const total       = subtotalBase + impuestoAmt - Number(form.descuento || 0);

  // Construye el payload de ítems y lo pasa al padre junto con los totales
  // calculados, de modo que `handleSave` no necesite recalcularlos.
  const handleSubmit = (e) => {
    e.preventDefault();
    const itemsPayload = items.map((item) => {
      const prod = productos.find((p) => String(p.id_producto) === String(item.producto_id));
      return {
        producto_id_producto: Number(item.producto_id),
        cantidad:             Number(item.cantidad),
        // El precio unitario se fija en el momento de emitir la factura para
        // que futuros cambios de precio no alteren el histórico de la factura.
        valor_unitario:       Number(prod?.valor_de_venta) || 0,
      };
    });
    onSave({ ...form, subtotal: subtotalBase, impuesto: impuestoAmt, total, productosItems: itemsPayload });
  };

  const isEdit = !!initialData;

  return (
    <Modal title={isEdit ? 'Editar Factura' : 'Generar Nueva Factura'} onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/*
          Banner de error de pedido duplicado dentro del modal.
          Se muestra cuando el padre recibe un HTTP 409 del backend, indicando
          que ya existe una factura vinculada a ese pedido. El modal permanece
          abierto para que el usuario pueda elegir otro pedido sin perder los demás
          campos del formulario.
        */}
        {pedidoError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 14 }}>
            {pedidoError}
          </div>
        )}

        <FormRow>
          <FormField label='Número de Factura' required>
            <Input name='numeroFactura' value={form.numeroFactura}
              onChange={handleChange} placeholder='F-2026-001' required />
          </FormField>
          {/*
            El pedido asociado es opcional. Al seleccionar un pedido el modal
            oculta la sección de productos y habilita el campo de subtotal manual,
            porque el valor ya viene determinado por el pedido.
            Al dejarlo en 'Sin pedido asociado' se activa el modo venta directa
            con cálculo automático de subtotal.
          */}
          <FormField label='Pedido Asociado'>
            <Select name='idPedido' value={form.idPedido} onChange={handleChange}>
              <option value=''>Sin pedido asociado</option>
              {pedidos.map((p) => (
                <option key={p.id_pedido ?? p.id} value={p.id_pedido ?? p.id}>
                  {p.id_pedido ?? p.id} — {p.cliente ?? p.nombre_cliente}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        {/*
          Sección de productos para venta directa (sin pedido asociado).
          Solo se renderiza cuando form.idPedido está vacío.

          Cada línea de producto tiene:
          - Campo de búsqueda libre (item.busqueda): filtra el catálogo de productos
            en tiempo real para esa línea específica, sin afectar las demás.
            El filtro compara contra nombre_producto ignorando mayúsculas.
          - Select de producto: muestra solo los productos que coinciden con la búsqueda
            de esa línea (productosFiltrados).
          - Campo de cantidad: número entero ≥ 1.
          - Total de línea (lineaTotal): valor_de_venta × cantidad, calculado y mostrado
            en tiempo real como referencia visual; no es un campo editable.
          - Botón × para eliminar la línea. Se deshabilita cuando solo queda una línea
            para garantizar que siempre haya al menos un producto en la factura.

          Los labels de cabecera (Buscar, Producto, Cant.) solo aparecen en la primera
          fila (idx === 0) para evitar que se repitan en cada línea adicional.
        */}
        {!form.idPedido && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Productos</p>
            {items.map((item, idx) => {
              const prodSeleccionado   = productos.find((p) => String(p.id_producto) === String(item.producto_id));
              const productosFiltrados = productos.filter((p) =>
                p.nombre_producto.toLowerCase().includes(item.busqueda.toLowerCase())
              );
              const lineaTotal = (Number(prodSeleccionado?.valor_de_venta) || 0) * (Number(item.cantidad) || 0);
              return (
                <div key={item._key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px auto auto', gap: 8, alignItems: 'end', marginBottom: 10 }}>
                  <FormField label={idx === 0 ? 'Buscar producto' : undefined}>
                    <Input
                      value={item.busqueda}
                      onChange={(e) => updateItem(item._key, 'busqueda', e.target.value)}
                      placeholder='Buscar...'
                    />
                  </FormField>
                  <FormField label={idx === 0 ? 'Producto' : undefined}>
                    <Select
                      value={item.producto_id}
                      onChange={(e) => updateItem(item._key, 'producto_id', e.target.value)}
                      required
                    >
                      <option value=''>Seleccionar...</option>
                      {productosFiltrados.map((p) => (
                        <option key={p.id_producto} value={p.id_producto}>
                          {p.nombre_producto}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={idx === 0 ? 'Cant.' : undefined}>
                    <Input
                      type='number' min='1'
                      value={item.cantidad}
                      onChange={(e) => updateItem(item._key, 'cantidad', e.target.value)}
                      placeholder='0' required
                    />
                  </FormField>
                  {/* Total calculado de la línea: solo visual, no editable */}
                  <div style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap', alignSelf: 'center', paddingBottom: 2 }}>
                    {formatCOP(lineaTotal)}
                  </div>
                  <button
                    type='button'
                    onClick={() => removeItem(item._key)}
                    disabled={items.length === 1}
                    style={{
                      background: 'none', border: 'none', padding: '0 4px',
                      fontSize: 20, lineHeight: 1, alignSelf: 'center',
                      cursor: items.length === 1 ? 'default' : 'pointer',
                      color:  items.length === 1 ? '#d1d5db' : '#ef4444',
                    }}
                  >×</button>
                </div>
              );
            })}
            <button
              type='button' onClick={addItem}
              style={{ fontSize: 13, color: '#2563eb', background: 'none', border: '1px dashed #93c5fd', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
            >+ Agregar Producto</button>
          </div>
        )}

        <FormRow>
          <FormField label='Fecha de Emisión' required>
            <Input type='date' name='fechaEmision' value={form.fechaEmision}
              onChange={handleChange} required />
          </FormField>
          <FormField label='Fecha de Vencimiento' required>
            <Input type='date' name='fechaVencimiento' value={form.fechaVencimiento}
              onChange={handleChange} required />
          </FormField>
        </FormRow>

        <FormRow>
          {/*
            El campo Subtotal tiene dos comportamientos según el modo:
            - Con pedido: input editable (el usuario ingresa el monto acordado).
            - Venta directa: deshabilitado, muestra `subtotalItems` calculado
              automáticamente; el usuario no puede sobreescribirlo.
          */}
          <FormField label='Subtotal (COP)' required>
            {form.idPedido
              ? <Input type='number' name='subtotal' min='0' value={form.subtotal} onChange={handleChange} placeholder='0' required />
              : <Input value={formatCOP(subtotalItems)} disabled />
            }
          </FormField>
          <FormField label='Impuesto (%)'>
            <Input type='number' name='impuesto' min='0' max='100'
              value={form.impuesto} onChange={handleChange} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Descuento (COP)'>
            <Input type='number' name='descuento' min='0'
              value={form.descuento} onChange={handleChange} />
          </FormField>
          <FormField label='Estado'>
            <Select name='estado' value={form.estado} onChange={handleChange}>
              <option value='emitida'>Emitida</option>
              <option value='pagada'>Pagada</option>
              <option value='vencida'>Vencida</option>
              <option value='anulada'>Anulada</option>
              <option value='parcial'>Parcial</option>
            </Select>
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Trabajador Responsable'>
            <Select name='trabajador' value={form.trabajador} onChange={handleChange}>
              <option value=''>Seleccionar...</option>
              {trabajadores.map((t) => (
                <option key={t.id ?? t.id_usuario_trab} value={t.id ?? t.id_usuario_trab}>
                  {t.nombre ?? t.user_name}
                </option>
              ))}
            </Select>
          </FormField>
          {/* El total calculado es solo de lectura; resume subtotal + impuesto − descuento */}
          <FormField label='Total Calculado'>
            <Input value={formatCOP(total)} disabled />
          </FormField>
        </FormRow>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Guardar Cambios' : 'Generar Factura'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Facturas() {
  const { isAdmin } = useRole();

  // Los tres estados arrancan con mock data para que la tabla y los selects
  // del modal tengan contenido mientras llegan las respuestas de la API.
  const [facturas, setFacturas]         = useState(mockFacturas);
  const [pedidos, setPedidos]           = useState(mockPedidos);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);

  const [search, setSearch]           = useState('');
  // `filtroEstado` permite filtrar la tabla por un estado concreto de factura.
  const [filtroEstado, setFiltroEstado] = useState('');
  const [showModal, setShowModal]     = useState(false);

  // `menuOpen` guarda el id_factura del menú ⋮ abierto, o null si ninguno.
  const [menuOpen, setMenuOpen] = useState(null);

  // `editando` guarda el id_factura en edición (null en creación).
  const [editando, setEditando]       = useState(null);
  // `initialData` contiene los valores normalizados para pre-llenar el formulario.
  const [initialData, setInitialData] = useState(null);

  // `pedidoError` recibe el mensaje HTTP 409 y se pasa al modal como prop
  // para mostrarlo dentro del formulario sin cerrarlo.
  const [pedidoError, setPedidoError] = useState('');

  // `confirmDelete` almacena la factura pendiente de eliminar.
  const [confirmDelete, setConfirmDelete] = useState(null);
  // `errorMsg` alimenta el banner de error rojo con auto-cierre.
  const [errorMsg, setErrorMsg] = useState('');

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // Los tres recursos se solicitan en paralelo al montar el componente.
  // El catch vacío de cada uno preserva los datos mock si el endpoint falla.
  useEffect(() => {
    api.get('/facturas')
      .then(({ data }) => setFacturas(data))
      .catch(() => {});

    api.get('/pedidos')
      .then(({ data }) => setPedidos(data))
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  // Cierra el modal y limpia todo el estado asociado, incluido pedidoError,
  // para que no persista al abrir el modal de nuevo.
  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
    setPedidoError('');
  };

  // Normaliza los campos de la factura para pre-llenar el formulario en edición.
  // La conversión más importante es la de impuesto: el backend almacena el monto
  // absoluto (ej. 19000 COP), pero el formulario trabaja con porcentaje (ej. 19 %).
  // Para recuperar el porcentaje se divide el monto entre el subtotal y se multiplica
  // por 100. Si el subtotal es 0 se usa 0 como fallback para evitar división por cero.
  const openEdit = (f) => {
    const sub = Number(f.subtotal) || 0;
    const imp = Number(f.impuesto) || 0;
    setInitialData({
      numeroFactura:    f.numero_factura,
      idPedido:         String(f.pedido_id_pedido ?? ''),
      fechaEmision:     f.fecha_emision?.slice(0, 10) ?? '',
      fechaVencimiento: f.fecha_vencimiento?.slice(0, 10) ?? '',
      subtotal:         String(sub),
      impuesto:         sub > 0 ? Math.round((imp / sub) * 100) : 0,
      descuento:        String(Number(f.descuento) || 0),
      estado:           f.estado ?? 'emitida',
      trabajador:       String(f.usuario_trab_id ?? ''),
    });
    setEditando(f.id_factura);
    setMenuOpen(null);
    setPedidoError('');
    setShowModal(true);
  };

  // ── Filtro combinado de búsqueda + estado ─────────────────────────────────
  // Las dos condiciones se aplican con AND: solo pasan las facturas que cumplen
  // ambas simultáneamente.
  // - `matchSearch`: compara el texto libre contra el número de factura y el ID
  //   del pedido asociado, ignorando mayúsculas.
  // - `matchEstado`: si filtroEstado está vacío deja pasar todo; si tiene un valor,
  //   solo pasan las facturas con ese estado exacto.
  const filtered = facturas.filter((f) => {
    const matchSearch = (f.numero_factura ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(f.pedido_id_pedido ?? '').toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || f.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  // ── Eliminación con confirmación ──────────────────────────────────────────
  const handleConfirmDelete = async () => {
    const f = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/facturas/${f.id_factura}`);
      setFacturas((prev) => prev.filter((x) => x.id_factura !== f.id_factura));
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar factura';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // ── Guardar factura (crear o editar) ──────────────────────────────────────
  const handleSave = async (form) => {
    // Lee el ID del trabajador autenticado desde localStorage para adjuntarlo
    // como usuario_trab_id, registrando quién emitió o editó la factura.
    const storedUser    = JSON.parse(localStorage.getItem('siape_user') || 'null');
    const usuarioTrabId = storedUser?.id || null;

    const payload = {
      numero_factura:    form.numeroFactura,
      fecha_emision:     form.fechaEmision,
      fecha_vencimiento: form.fechaVencimiento || null,
      subtotal:          Number(form.subtotal),
      impuesto:          form.impuesto,
      descuento:         Number(form.descuento) || 0,
      estado:            form.estado,
      usuario_trab_id:   usuarioTrabId,
      pedido_id_pedido:  form.idPedido ? Number(form.idPedido) : null,
      // El array de productos solo se incluye en venta directa (sin pedido).
      // El spread condicional omite la clave `productos` por completo cuando
      // hay pedido, evitando que el backend intente procesar un array vacío.
      ...(!form.idPedido && {
        productos: form.productosItems,
      }),
    };

    setPedidoError('');
    try {
      if (editando) {
        await api.put(`/facturas/${editando}`, payload);
      } else {
        await api.post('/facturas', payload);
      }
      // Recarga la lista completa para reflejar los totales calculados por el servidor.
      const { data } = await api.get('/facturas');
      setFacturas(data);
      closeModal();
    } catch (error) {
      console.error(error);
      // Validación de pedido duplicado:
      // El backend devuelve HTTP 409 (Conflict) cuando ya existe una factura para
      // ese pedido. En ese caso se actualiza `pedidoError` y el modal permanece
      // abierto mostrando el error dentro del formulario, sin perder los datos.
      // Para cualquier otro error se muestra un alert y se cierra el modal.
      if (error.response?.status === 409) {
        setPedidoError(error.response.data?.message || 'Ya existe una factura para ese pedido.');
      } else {
        const msg = error.response?.data?.message || `Error al ${editando ? 'editar' : 'crear'} factura`;
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(''), 4000);
      }
    }
  };

  return (
    <div className={styles.page}>
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

      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por número o pedido...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Filtro de estado: se combina con la búsqueda de texto (AND) */}
        <select
          className={styles.filterSelect}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value=''>Todos los estados</option>
          <option value='emitida'>Emitida</option>
          <option value='pagada'>Pagada</option>
          <option value='vencida'>Vencida</option>
          <option value='anulada'>Anulada</option>
          <option value='parcial'>Parcial</option>
        </select>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Generar Nueva Factura
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Flujo: clic en "Eliminar" → setConfirmDelete(f) → aparece este banner →
          "Confirmar" ejecuta handleConfirmDelete → "Cancelar" limpia el estado. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar la factura <strong>{confirmDelete.numero_factura}</strong>? Esta acción no se puede deshacer.</span>
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
              <th>Número Factura</th>
              <th>F. Emisión</th>
              <th>F. Vencimiento</th>
              <th>Subtotal</th>
              <th>Impuesto</th>
              <th>Descuento</th>
              <th>Total</th>
              <th>Estado</th>
              <th>ID Pedido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id_factura}>
                <td className={styles.mono}>{f.id_factura}</td>
                <td className={styles.factNum}>{f.numero_factura}</td>
                <td>{formatDate(f.fecha_emision)}</td>
                <td>{formatDate(f.fecha_vencimiento)}</td>
                <td>{formatCOP(f.subtotal)}</td>
                <td>{formatCOP(f.impuesto)}</td>
                <td>{formatCOP(f.descuento)}</td>
                <td className={styles.total}>{formatCOP(f.total)}</td>
                <td>
                  <span className={`${styles.badge} ${estadoClass(f.estado)}`}>
                    {f.estado}
                  </span>
                </td>
                <td className={styles.mono}>{f.pedido_id_pedido}</td>
                <td className={styles.menuCell}>
                  {/* Menú de tres puntos exclusivo para administradores */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={() => setMenuOpen(menuOpen === f.id_factura ? null : f.id_factura)}
                      >⋮</button>
                      {menuOpen === f.id_factura && (
                        <div className={styles.dropdown}>
                          <button onClick={() => openEdit(f)}>✏️ Editar</button>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(f); setMenuOpen(null); }}
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
          <p className={styles.empty}>No se encontraron facturas.</p>
        )}
      </div>

      {/* `nextNum` sugiere el siguiente correlativo basado en la cantidad de facturas
          existentes. Solo aplica en creación; en edición initialData ya tiene el número. */}
      {showModal && (
        <FacturaModal
          onClose={closeModal}
          onSave={handleSave}
          pedidos={pedidos}
          trabajadores={trabajadores}
          nextNum={facturas.length + 1}
          initialData={initialData}
          pedidoError={pedidoError}
        />
      )}
    </div>
  );
}

export default Facturas;
