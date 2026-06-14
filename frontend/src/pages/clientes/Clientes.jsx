// Página de gestión de clientes. Lista todos los clientes registrados y permite
// a los administradores crearlos, editarlos y eliminarlos.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockClientes } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Clientes.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de cliente
// ─────────────────────────────────────────────────────────────────────────────
// El mismo modal sirve para los dos modos. La presencia de `item` lo determina:
// - item === undefined → creación: el formulario arranca vacío y el título dice "Agregar".
// - item !== undefined → edición: el formulario se pre-llena con los datos actuales
//   y el título dice "Editar".
function ClienteModal({ item, onClose, onSave }) {
  // Los campos se inicializan con los valores del cliente existente (edición)
  // o con strings vacíos (creación). El operador ?. evita errores si item es undefined.
  const [form, setForm] = useState({
    nombre_usuario: item?.nombre_usuario ?? '',
    correo:         item?.correo         ?? '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Delega la llamada a la API al componente padre, que sabe si debe hacer
    // POST (handleSave) o PUT (handleUpdate) según el contexto de apertura.
    onSave(form);
  };

  return (
    <Modal title={item ? 'Editar Cliente' : 'Agregar Cliente'} onClose={onClose} size='sm'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Nombre de Usuario' required>
          <Input
            value={form.nombre_usuario}
            onChange={(e) => setForm({ ...form, nombre_usuario: e.target.value })}
            placeholder='Nombre completo o razón social'
            required
          />
        </FormField>
        <FormField label='Correo Electrónico' required>
          <Input
            type='email'
            value={form.correo}
            onChange={(e) => setForm({ ...form, correo: e.target.value })}
            placeholder='correo@empresa.com'
            required
          />
        </FormField>
        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>Guardar Cliente</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Clientes() {
  const { isAdmin } = useRole();

  // El estado se inicializa con mockClientes para que la tabla no quede vacía
  // mientras llega la respuesta de la API. En cuanto el useEffect resuelve,
  // setClientes reemplaza los datos mock con los reales del servidor.
  const [clientes, setClientes] = useState(mockClientes);
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);

  // `editando` almacena el objeto completo del cliente que se está editando,
  // o null cuando no hay edición activa. Su presencia es la que monta el
  // segundo ClienteModal (modo edición).
  const [editando, setEditando] = useState(null);

  // `menuOpen` guarda el id_usuario_cli del menú ⋮ abierto, o null si ninguno.
  const [menuOpen, setMenuOpen] = useState(null);

  // `confirmDelete` almacena el objeto del cliente pendiente de eliminar.
  // Su presencia monta el banner de confirmación.
  const [confirmDelete, setConfirmDelete] = useState(null);

  // `errorMsg` alimenta el banner de error rojo. A diferencia de otras páginas,
  // aquí no hay auto-cierre con setTimeout: el banner persiste hasta que el
  // usuario lo cierra manualmente con el botón ✕.
  const [errorMsg, setErrorMsg] = useState(null);

  // ── Carga inicial de clientes ─────────────────────────────────────────────
  // Reemplaza los datos mock por los reales del servidor al montar el componente.
  // El catch vacío evita que un error de red rompa el render; en ese caso
  // los datos mock permanecen visibles como fallback.
  useEffect(() => {
    api.get('/clientes')
      .then(({ data }) => setClientes(data))
      .catch(() => {});
  }, []);

  // ── Cierre del menú de tres puntos al hacer clic fuera ───────────────────
  // El listener global de 'click' resetea menuOpen a null en cualquier clic
  // que no sea interceptado por e.stopPropagation(). El botón ⋮ llama a
  // e.stopPropagation() para que el clic que abre el menú no lo cierre
  // inmediatamente al propagarse hasta el document.
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ── Filtro de búsqueda en tiempo real ────────────────────────────────────
  // Filtra sobre el array en memoria sin peticiones al servidor.
  // Compara la cadena de búsqueda contra nombre_usuario y correo,
  // ignorando mayúsculas y minúsculas en ambos lados.
  const filtered = clientes.filter(
    (c) =>
      (c.nombre_usuario ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.correo ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Helper compartido que recarga la lista completa desde el servidor.
  // Se llama tras crear, editar o eliminar para mantener la tabla sincronizada
  // con el estado real de la base de datos.
  const reloadClientes = async () => {
    const { data } = await api.get('/clientes');
    setClientes(data);
  };

  // ── Crear cliente ─────────────────────────────────────────────────────────
  // Si el POST tiene éxito recarga la lista desde el servidor.
  // Si falla (backend caído, red, etc.) agrega el cliente al estado local con
  // un ID temporal (Date.now()) para que el usuario no pierda el registro;
  // en cuanto el backend vuelva a estar disponible, reloadClientes lo sincronizará.
  const handleSave = async (form) => {
    try {
      await api.post('/clientes', { nombre_usuario: form.nombre_usuario, correo: form.correo });
      await reloadClientes();
    } catch {
      setClientes((prev) => [...prev, { id: Date.now(), ...form }]);
    }
    setShowModal(false);
  };

  // ── Editar cliente ────────────────────────────────────────────────────────
  // Envía únicamente los campos editables (nombre y correo); el ID va en la URL.
  // Tras el PUT recarga la lista para reflejar los datos guardados por el servidor.
  // setEditando(null) al final desmonta el modal de edición independientemente
  // del resultado, para que el usuario no quede atrapado en él si hay un error.
  const handleUpdate = async (form) => {
    try {
      await api.put(`/clientes/${editando.id_usuario_cli}`, {
        nombre_usuario: form.nombre_usuario,
        correo:         form.correo,
      });
      await reloadClientes();
    } catch (err) {
      console.error(err);
    }
    setEditando(null);
  };

  // ── Eliminación con validación de pedidos asociados ───────────────────────
  // Se invoca solo cuando el usuario confirma en el banner de confirmación.
  // 1. Cierra el banner de inmediato para evitar doble clic.
  // 2. Llama a DELETE /clientes/:id.
  // 3. Si el cliente tiene pedidos activos, el backend rechaza la operación
  //    por integridad referencial y devuelve un mensaje en error.response.data.message
  //    que se muestra en el banner de error rojo.
  // 4. Si tiene éxito, recarga la lista desde el servidor.
  const handleConfirmDelete = async () => {
    const cliente = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/clientes/${cliente.id_usuario_cli}`);
      await reloadClientes();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error al eliminar el cliente.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          {/* El input actualiza `search` en cada pulsación, lo que hace que
              `filtered` se recalcule en el siguiente render sin peticiones al servidor. */}
          <input
            className={styles.search}
            placeholder='Buscar por nombre o correo...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          + Agregar Cliente
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Se monta cuando `confirmDelete` tiene un cliente pendiente.
          "Confirmar" ejecuta handleConfirmDelete; "Cancelar" limpia
          confirmDelete sin enviar ninguna petición al servidor. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar el cliente <strong>{confirmDelete.nombre_usuario}</strong>? Esta acción no se puede deshacer.</span>
          <div className={styles.confirmBannerActions}>
            <button className={styles.confirmBannerCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className={styles.confirmBannerConfirm} onClick={handleConfirmDelete}>Confirmar</button>
          </div>
        </div>
      )}

      {/* ── Banner de error ───────────────────────────────────────────────────
          Aparece cuando el backend rechaza una operación (p. ej. eliminar un
          cliente con pedidos vinculados). No tiene auto-cierre: persiste hasta
          que el usuario lo descarta con ✕. */}
      {errorMsg && (
        <div className={styles.errorBanner}>
          <span>{errorMsg}</span>
          <button className={styles.errorBannerClose} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id_usuario_cli}>
                <td className={styles.mono}>{c.id_usuario_cli}</td>
                <td className={styles.nombre}>{c.nombre_usuario}</td>
                <td className={styles.correo}>{c.correo}</td>
                <td className={styles.menuCell}>
                  {/*
                    Menú de tres puntos: solo se renderiza cuando el usuario es admin.
                    e.stopPropagation() en el botón ⋮ evita que el evento llegue al
                    listener global de 'click' y cierre el menú recién abierto.
                    El toggle compara menuOpen con el ID del cliente actual:
                    si ya está abierto lo cierra, si no lo abre (cerrando cualquier
                    otro implícitamente al reemplazar el valor de menuOpen).
                  */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id_usuario_cli ? null : c.id_usuario_cli); }}
                      >⋮</button>
                      {menuOpen === c.id_usuario_cli && (
                        <div className={styles.dropdown}>
                          <button onClick={() => { setEditando(c); setMenuOpen(null); }}>✏️ Editar</button>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(c); setMenuOpen(null); }}
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
          <p className={styles.empty}>No se encontraron clientes.</p>
        )}
      </div>

      {/* Modal de creación: se monta cuando showModal es true.
          Al cerrarse se desmonta y su estado interno se destruye. */}
      {showModal && (
        <ClienteModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}

      {/* Modal de edición: se monta cuando `editando` tiene un cliente.
          Recibe el objeto completo como `item` para pre-llenar el formulario.
          Al cerrarse setEditando(null) lo desmonta. */}
      {editando && (
        <ClienteModal item={editando} onClose={() => setEditando(null)} onSave={handleUpdate} />
      )}
    </div>
  );
}

export default Clientes;
