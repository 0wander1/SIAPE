import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, Textarea, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pedidos.module.css';

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

function PedidoModal({ onClose, onSave, clientes, productos, initialData }) {
  const emptyForm = {
    cliente: '', producto: '', cantidad: '', direccion: '',
    fechaEstimada: '', estado: 'pendiente', observaciones: '', valorTotal: 0,
  };

  const [form, setForm] = useState(initialData ?? emptyForm);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    if (name === 'producto' || name === 'cantidad') {
      const prod = productos.find(
        (p) => String(p.id_producto ?? p.id) === String(name === 'producto' ? value : form.producto)
      );
      const cant = Number(name === 'cantidad' ? value : form.cantidad);
      updated.valorTotal = prod ? Number(prod.valor_de_venta ?? prod.precio ?? 0) * cant : form.valorTotal;
    }
    setForm(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

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

function Pedidos() {
  const { isAdmin } = useRole();
  const [pedidos, setPedidos]     = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [productos, setProductos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(null);
  const [editando, setEditando]   = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api.get('/pedidos').then(({ data }) => setPedidos(data)).catch(() => {});
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {});
    api.get('/productos').then(({ data }) => setProductos(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

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

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

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

  const handleSave = async (form) => {
    const user = JSON.parse(localStorage.getItem('siape_user') || 'null');
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
      if (editando) {
        await api.put(`/pedidos/${editando}`, payload);
      } else {
        await api.post('/pedidos', payload);
      }
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

      {errorMsg && (
        <div className={styles.errorBanner}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className={styles.errorBannerClose}>✕</button>
        </div>
      )}

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
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
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
