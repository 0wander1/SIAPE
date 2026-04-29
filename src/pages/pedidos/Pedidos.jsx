import { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, Textarea, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockPedidos, mockClientes, mockInventario } from '../../utils/mockData.js';
import { formatCOP, formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Pedidos.module.css';

const PRECIO_UNITARIO = {
  'P001': 3500, 'P002': 11500, 'P003': 8000,
  'P004': 3000, 'P005': 7000, 'P006': 12000,
};

const estadoClass = (estado) => {
  const map = {
    'Pendiente': styles.badgePending,
    'En tránsito': styles.badgeTransit,
    'Entregado': styles.badgeDelivered,
    'Cancelado': styles.badgeCancelled,
  };
  return map[estado] || styles.badgePending;
};

const emptyForm = {
  cliente: '',
  producto: '',
  cantidad: '',
  direccion: '',
  fechaEstimada: '',
  estado: 'Pendiente',
  observaciones: '',
  valorTotal: 0,
};

function NuevoPedidoModal({ onClose, onSave, clientes, inventario }) {
  const [form, setForm] = useState(emptyForm);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };

    if (name === 'producto' || name === 'cantidad') {
      const prodId = name === 'producto' ? value : form.producto;
      const cant = name === 'cantidad' ? Number(value) : Number(form.cantidad);
      const precio = PRECIO_UNITARIO[prodId] || 0;
      updated.valorTotal = precio * cant;
    }

    setForm(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const productoSeleccionado = inventario.find((p) => p.id === form.producto);

  return (
    <Modal title='Nuevo Pedido' onClose={onClose} size='lg'>
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
              {inventario.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
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
            <Input value={form.estado} disabled />
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

        {productoSeleccionado && (
          <div className={styles.stockInfo}>
            Stock disponible: <strong>{productoSeleccionado.cantidadDisponible} uds</strong> —
            Proveedor: <strong>{productoSeleccionado.proveedor}</strong>
          </div>
        )}

        <FormField label='Observaciones'>
          <Textarea
            name='observaciones' value={form.observaciones} onChange={handleChange}
            placeholder='Instrucciones adicionales...'
          />
        </FormField>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Crear Pedido</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

function Pedidos() {
  const [pedidos, setPedidos] = useState(mockPedidos);
  const [clientes, setClientes] = useState(mockClientes);
  const [inventario, setInventario] = useState(mockInventario);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.get('/pedidos')
      .then(({ data }) => setPedidos(data))
      .catch(() => {});

    api.get('/clientes')
      .then(({ data }) => setClientes(data))
      .catch(() => {});

    api.get('/inventario')
      .then(({ data }) => setInventario(data))
      .catch(() => {});
  }, []);

  const handleSave = async (form) => {
    try {
      await api.post('/pedidos', {
        cliente_id_usuario_cli:  Number(form.cliente),
        producto_id_producto:    form.producto,
        cantidad:                Number(form.cantidad),
        estado:                  form.estado,
        valor_total:             form.valorTotal,
        direccion_pedido:        form.direccion,
        fecha_entrega_estimada:  form.fechaEstimada || null,
        observaciones:           form.observaciones || null,
      });
      const { data } = await api.get('/pedidos');
      setPedidos(data);
    } catch {
      const nombreCliente = clientes.find(
        (c) => (c.id ?? c.id_usuario_cli) == form.cliente
      )?.nombre ?? clientes.find(
        (c) => (c.id ?? c.id_usuario_cli) == form.cliente
      )?.nombre_usuario ?? form.cliente;
      const nombreProducto = inventario.find((p) => p.id === form.producto)?.nombre || form.producto;
      setPedidos((prev) => [{
        id: `PED-00${prev.length + 1}`,
        cliente: nombreCliente,
        producto: nombreProducto,
        cantidad: Number(form.cantidad),
        estado: form.estado,
        valorTotal: form.valorTotal,
        direccion: form.direccion,
        fechaEstimada: form.fechaEstimada,
        fechaReal: null,
        observaciones: form.observaciones,
      }, ...prev]);
    }
    setShowModal(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>Gestión de Pedidos</h2>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Nuevo Pedido
        </button>
      </div>

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <NuevoPedidoModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          clientes={clientes}
          inventario={inventario}
        />
      )}
    </div>
  );
}

export default Pedidos;
