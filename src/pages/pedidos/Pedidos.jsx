// Página de gestión de pedidos. Lista todos los pedidos del sistema y permite
// a los administradores crearlos, editarlos y eliminarlos.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, Textarea, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pedidos.module.css';

// Resuelve la clase CSS del badge de estado según el valor que devuelve el backend.
// Devuelve badgePending como fallback para estados desconocidos.
const estadoClass = (estado) => {
  const map = {
    'pendiente':      styles.badgePending,
    'confirmado':     styles.badgeConfirmed,
    'en_preparacion': styles.badgePrep,
    'despachado':     styles.badgeTransit,
    'entregado':      styles.badgeDelivered,
    'cancelado':      styles.badgeCancelled,
  };
  return map[estado] || styles.badgePending;
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de pedido
// ─────────────────────────────────────────────────────────────────────────────
// Recibe `initialData` cuando se edita un pedido existente; si es null o undefined
// el formulario arranca vacío (modo creación). Esta distinción se hace una sola
// vez al inicializar el estado con `initialData ?? emptyForm`.
function PedidoModal({ onClose, onSave, clientes, productos, initialData }) {
  const emptyForm = {
    cliente: '', producto: '', cantidad: '', direccion: '',
    fechaEstimada: '', estado: 'pendiente', observaciones: '', valorTotal: 0,
  };

  // En edición, el estado inicial viene de `initialData` ya normalizado por openEdit().
  // En creación, parte de emptyForm con el estado 'pendiente' por defecto.
  const [form, setForm] = useState(initialData ?? emptyForm);

  // Handler genérico que actualiza el campo correspondiente y,
  // cuando el usuario cambia el producto o la cantidad, recalcula el valorTotal
  // automáticamente multiplicando el precio unitario del producto por la cantidad.
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };

    if (name === 'producto' || name === 'cantidad') {
      // Busca el producto por ID (comparando como string para tolerar number/string del backend).
      // Si se acaba de cambiar 'producto', usa el nuevo value; si se cambió 'cantidad',
      // usa el producto ya seleccionado en el formulario.
      const prod = productos.find(
        (p) => String(p.id_producto ?? p.id) === String(name === 'producto' ? value : form.producto)
      );
      const cant = Number(name === 'cantidad' ? value : form.cantidad);
      // El campo valorTotal se muestra deshabilitado en el formulario; es solo de lectura
      // para el usuario y se recalcula aquí en cada cambio relevante.
      updated.valorTotal = prod ? Number(prod.valor_de_venta ?? prod.precio ?? 0) * cant : form.valorTotal;
    }
    setForm(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Delega la lógica de POST/PUT al padre (handleSave en Pedidos),
    // que sabe si se está creando o editando según el estado `editando`.
    onSave(form);
  };

  // Determina el título del modal y el texto del botón de envío.
  const isEdit = !!initialData;

  return (
    <Modal title={isEdit ? 'Editar Pedido' : 'Nuevo Pedido'} onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormRow>
          <FormField label='Cliente' required>
            <Select name='cliente' value={form.cliente} onChange={handleChange} required>
              <option value=''>Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id ?? c.id_usuario_cli} value={c.id ?? c.id_usuario_cli}>
                  {c.nombre ?? c.nombre_usuario}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label='Producto' required>
            <Select name='producto' value={form.producto} onChange={handleChange} required>
              <option value=''>Seleccionar producto...</option>
              {productos.map((p) => (
                <option key={p.id_producto ?? p.id} value={p.id_producto ?? p.id}>
                  {p.nombre_producto ?? p.nombre}
                </option>
              ))}
            </Select>
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Cantidad' required>
            <Input
              type='number' name='cantidad' min='1'
              value={form.cantidad} onChange={handleChange}
              placeholder='0' required
            />
          </FormField>
          <FormField label='Estado'>
            <Select name='estado' value={form.estado} onChange={handleChange}>
              <option value='pendiente'>Pendiente</option>
              <option value='confirmado'>Confirmado</option>
              <option value='en_preparacion'>En Preparación</option>
              <option value='despachado'>Despachado</option>
              <option value='entregado'>Entregado</option>
              <option value='cancelado'>Cancelado</option>
            </Select>
          </FormField>
        </FormRow>

        <FormField label='Dirección de Envío' required>
          <Input
            name='direccion' value={form.direccion} onChange={handleChange}
            placeholder='Cra 10 #20-30, Ciudad' required
          />
        </FormField>

        <FormRow>
          <FormField label='Fecha de Entrega Estimada' required>
            <Input
              type='date' name='fechaEstimada'
              value={form.fechaEstimada} onChange={handleChange} required
            />
          </FormField>
          {/* El valor total es calculado automáticamente y no editable por el usuario */}
          <FormField label='Valor Total'>
            <Input value={formatCOP(form.valorTotal)} disabled />
          </FormField>
        </FormRow>

        <FormField label='Observaciones'>
          <Textarea
            name='observaciones' value={form.observaciones} onChange={handleChange}
            placeholder='Instrucciones adicionales...'
          />
        </FormField>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Guardar Cambios' : 'Crear Pedido'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Pedidos() {
  const { isAdmin } = useRole();

  const [pedidos, setPedidos]     = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [productos, setProductos] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // `menuOpen` almacena el ID del pedido cuyo menú de tres puntos está visible,
  // o null si ningún menú está abierto. Solo puede haber uno abierto a la vez.
  const [menuOpen, setMenuOpen] = useState(null);

  // `editando` guarda el ID del pedido que se está editando (null en creación).
  // `initialData` contiene los valores normalizados para pre-llenar el formulario.
  const [editando, setEditando]       = useState(null);
  const [initialData, setInitialData] = useState(null);

  // `errorMsg` muestra el banner de error rojo (p. ej. al intentar eliminar un
  // pedido con factura asociada). Se auto-limpia a los 4 segundos.
  const [errorMsg, setErrorMsg] = useState('');

  // `confirmDelete` almacena el objeto del pedido pendiente de eliminar.
  // Cuando es distinto de null se renderiza el banner de confirmación.
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // Los tres recursos se piden de forma independiente al montar el componente.
  // Clientes y productos se necesitan para poblar los selects del modal.
  useEffect(() => {
    api.get('/pedidos').then(({ data }) => setPedidos(data)).catch(() => {});
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {});
    api.get('/productos').then(({ data }) => setProductos(data)).catch(() => {});
  }, []);

  // ── Cierre del menú de tres puntos al hacer clic fuera ───────────────────
  // Se registra un listener global de 'click' en el documento. Cuando el usuario
  // hace clic en cualquier parte que NO sea el propio botón ⋮ (que usa
  // e.stopPropagation() para evitar que este listener lo cierre al abrirlo),
  // setMenuOpen(null) cierra el menú que esté abierto.
  // El cleanup del useEffect elimina el listener al desmontar el componente.
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Muestra el banner de error durante 4 segundos y luego lo oculta.
  // Se usa, entre otros casos, cuando el backend rechaza la eliminación de un
  // pedido que ya tiene una factura asociada (el servidor devuelve un mensaje
  // explicativo en error.response.data.message).
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // ── Confirmación y ejecución de eliminación ───────────────────────────────
  // Se invoca solo cuando el usuario hace clic en "Confirmar" dentro del banner.
  // 1. Cierra el banner inmediatamente para evitar doble clic.
  // 2. Llama al endpoint DELETE.
  // 3. Si tiene éxito, elimina el pedido del estado local sin recargar la lista.
  // 4. Si el backend devuelve error (p. ej. llave foránea con facturas),
  //    muestra el mensaje en el banner de error rojo.
  const handleConfirmDelete = async () => {
    const p = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/pedidos/${p.id}`);
      setPedidos((prev) => prev.filter((x) => x.id !== p.id));
    } catch (error) {
      console.error(error);
      showError(error.response?.data?.message || 'Error al eliminar pedido');
    }
  };

  // Cierra el modal y limpia el estado de edición para que la próxima
  // apertura del modal arranque siempre en modo creación con formulario vacío.
  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

  // Prepara el modal para editar un pedido existente:
  // - Normaliza los IDs a string para que coincidan con los values de los <option>.
  // - Trunca la fecha ISO a YYYY-MM-DD para que el input type='date' la reconozca.
  // - Cierra el menú de tres puntos antes de abrir el modal.
  const openEdit = (p) => {
    setInitialData({
      cliente:       String(p.clienteId ?? ''),
      producto:      String(p.productoId ?? ''),
      cantidad:      String(p.cantidad ?? ''),
      direccion:     p.direccion ?? '',
      fechaEstimada: p.fechaEstimada?.slice(0, 10) ?? '',
      estado:        p.estado ?? 'Pendiente',
      observaciones: p.observaciones ?? '',
      valorTotal:    Number(p.valorTotal ?? 0),
    });
    setEditando(p.id);
    setMenuOpen(null);
    setShowModal(true);
  };

  // ── Guardar pedido (crear o editar) ──────────────────────────────────────
  const handleSave = async (form) => {
    // Lee el objeto de usuario autenticado desde localStorage para adjuntar
    // usuario_trab_id al payload. El backend lo usa para registrar qué trabajador
    // creó o modificó el pedido.
    const user = JSON.parse(localStorage.getItem('siape_user') || 'null');

    // Construye el payload con los nombres de campo que espera el backend,
    // que difieren de los nombres internos del formulario.
    const payload = {
      cliente_id_usuario_cli: Number(form.cliente),
      producto_id_producto:   form.producto,
      cantidad:               Number(form.cantidad),
      estado:                 form.estado,
      valor_total:            form.valorTotal,
      direccion_pedido:       form.direccion,
      fecha_entrega_estimada: form.fechaEstimada || null,
      observaciones:          form.observaciones || null,
      usuario_trab_id:        user?.id,
    };

    try {
      // Si `editando` tiene un ID se hace PUT; de lo contrario POST.
      if (editando) {
        await api.put(`/pedidos/${editando}`, payload);
      } else {
        await api.post('/pedidos', payload);
      }
      // Recarga la lista completa desde el servidor para reflejar los datos
      // definitivos (IDs generados, joins resueltos, etc.) sin manipulación local.
      const { data } = await api.get('/pedidos');
      setPedidos(data);
      closeModal();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || `Error al ${editando ? 'editar' : 'crear'} pedido`);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>Gestión de Pedidos</h2>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Nuevo Pedido
        </button>
      </div>

      {/* ── Banner de error ───────────────────────────────────────────────────
          Se muestra cuando el backend rechaza una operación, por ejemplo al
          intentar eliminar un pedido que tiene una factura asociada (el servidor
          devuelve el motivo en el cuerpo del error). El botón ✕ permite cerrarlo
          manualmente antes de los 4 segundos del auto-dismiss. */}
      {errorMsg && (
        <div className={styles.errorBanner}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className={styles.errorBannerClose}>✕</button>
        </div>
      )}

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Se monta solo cuando `confirmDelete` tiene un pedido pendiente.
          El flujo es: el usuario abre el menú ⋮ → hace clic en "Eliminar" →
          se guarda el pedido en `confirmDelete` → aparece este banner →
          el usuario elige "Confirmar" (handleConfirmDelete) o "Cancelar"
          (setConfirmDelete(null) desmonta el banner sin borrar nada). */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el pedido <strong>#{confirmDelete.id}</strong>? Esta acción no se puede deshacer.</span>
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
              <th>Cliente</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Estado</th>
              <th>Valor Total</th>
              <th>Dirección</th>
              <th>F. Estimada</th>
              <th>F. Real</th>
              <th>Observaciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className={styles.mono}>{p.id}</td>
                <td>{p.cliente}</td>
                <td>{p.producto}</td>
                <td>{p.cantidad}</td>
                <td>
                  <span className={`${styles.badge} ${estadoClass(p.estado)}`}>
                    {p.estado}
                  </span>
                </td>
                <td>{formatCOP(p.valorTotal)}</td>
                <td className={styles.addr}>{p.direccion}</td>
                <td>{formatDate(p.fechaEstimada)}</td>
                <td>{formatDate(p.fechaReal)}</td>
                <td className={styles.obs}>{p.observaciones || '-'}</td>
                <td className={styles.menuCell}>
                  {/* El menú de tres puntos solo se renderiza para administradores */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      {/*
                        e.stopPropagation() es esencial: sin él, el clic en ⋮ también
                        dispararía el listener global de 'click' registrado en el useEffect,
                        que llama a setMenuOpen(null) y cerraría el menú recién abierto.
                        Al detener la propagación, solo se ejecuta el toggle local.
                        El toggle usa `menuOpen === p.id` para alternar: si el menú de
                        este pedido ya está abierto lo cierra; si no, lo abre.
                      */}
                      <button
                        className={styles.menuBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                      >⋮</button>
                      {menuOpen === p.id && (
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
      </div>

      {/* El modal se monta condicionalmente para que al cerrarlo su estado
          interno se destruya y la próxima apertura parta siempre de cero. */}
      {showModal && (
        <PedidoModal
          onClose={closeModal}
          onSave={handleSave}
          clientes={clientes}
          productos={productos}
          initialData={initialData}
        />
      )}
    </div>
  );
}

export default Pedidos;
