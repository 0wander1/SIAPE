// Página de gestión de bodegas. Lista todas las bodegas con búsqueda por
// descripción o ciudad y permite a los administradores crearlas, editarlas
// y eliminarlas.

import { useState, useEffect } from 'react';
import useRole from '../../hooks/useRole.js';
import Modal from '../../components/Modal.jsx';
import FormField, {
  Input, Select, FormRow, FormActions, BtnPrimary, BtnSecondary,
} from '../../components/FormField.jsx';
import { mockBodegas, mockTrabajadores } from '../../utils/mockData.js';
import api from '../../services/api.js';
import styles from './Bodegas.module.css';

// Valores iniciales del formulario en modo creación.
// `tipo` parte en 'Seca' (primer valor del ENUM en la base de datos).
// `estado` parte en true (activa) porque una bodega recién creada estará operativa.
const emptyForm = {
  descripcion: '', ubicacion: '', ciudad: '', capacidadMaxima: '',
  capacidadActual: '', tipo: 'Seca', estado: true, trabajador: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación / edición de bodega
// ─────────────────────────────────────────────────────────────────────────────
function BodegaModal({ onClose, onSave, trabajadores, initialData, isEdit }) {
  // En edición, `initialData` contiene los valores normalizados por openEdit().
  // En creación, el formulario parte de emptyForm con sus valores por defecto.
  const [form, setForm] = useState(initialData ?? emptyForm);

  // Handler genérico para todos los campos del formulario.
  // Detecta si el input es un checkbox (type === 'checkbox') y en ese caso
  // usa `checked` (boolean) en lugar de `value` (string). Esto permite que el
  // campo `estado` se gestione como booleano real en lugar de "on"/"off".
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'Editar Bodega' : 'Agregar Bodega'} onClose={onClose} size='lg'>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label='Descripción' required>
          <Input name='descripcion' value={form.descripcion} onChange={handleChange}
            placeholder='Ej. Bodega Principal' required />
        </FormField>

        <FormRow>
          <FormField label='Ubicación' required>
            <Input name='ubicacion' value={form.ubicacion} onChange={handleChange}
              placeholder='Cra 10 #20-30' required />
          </FormField>
          <FormField label='Ciudad' required>
            <Input name='ciudad' value={form.ciudad} onChange={handleChange}
              placeholder='Bogotá' required />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label='Capacidad Máxima' required>
            <Input type='number' name='capacidadMaxima' min='1'
              value={form.capacidadMaxima} onChange={handleChange} required />
          </FormField>
          <FormField label='Capacidad Actual'>
            <Input type='number' name='capacidadActual' min='0'
              value={form.capacidadActual} onChange={handleChange} />
          </FormField>
        </FormRow>

        <FormRow>
          {/*
            Select del ENUM tipo_bodega. Los tres valores coinciden exactamente
            con los que acepta la columna ENUM en la base de datos: 'Seca',
            'Refrigerada' y 'Congelada'. El valor del form se envía al backend
            sin transformación como `tipo_bodega` en el payload de handleSave.
          */}
          <FormField label='Tipo'>
            <Select name='tipo' value={form.tipo} onChange={handleChange}>
              <option value='Seca'>Seca</option>
              <option value='Refrigerada'>Refrigerada</option>
              <option value='Congelada'>Congelada</option>
            </Select>
          </FormField>
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
        </FormRow>

        {/*
          Toggle de estado activa / inactiva.
          Es un checkbox HTML estilizado con CSS como un interruptor deslizante.
          El valor en el formulario es un booleano (true/false) gracias al handleChange
          que usa `checked` para los checkboxes.
          La etiqueta muestra 'Activa' o 'Inactiva' dinámicamente según form.estado.
          Al construir el payload en handleSave, el booleano se convierte a 1/0
          (form.estado ? 1 : 0) porque la columna `activa` en MySQL es TINYINT.
          En sentido inverso, openEdit() convierte el 1/0 que devuelve el backend
          a booleano con !!b.activa para que el checkbox quede pre-marcado.
        */}
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input
              type='checkbox' name='estado'
              checked={form.estado} onChange={handleChange}
              className={styles.toggleInput}
            />
            <span className={styles.toggleSlider} />
            Estado: <strong>{form.estado ? 'Activa' : 'Inactiva'}</strong>
          </label>
        </div>

        <FormActions>
          <BtnSecondary type='button' onClick={onClose}>Cancelar</BtnSecondary>
          <BtnPrimary type='submit'>{isEdit ? 'Actualizar Bodega' : 'Guardar Bodega'}</BtnPrimary>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
function Bodegas() {
  const { isAdmin } = useRole();

  // Ambos estados se inicializan con mock data para que la tabla y el select
  // del modal tengan contenido mientras llegan las respuestas de la API.
  const [bodegas, setBodegas]           = useState(mockBodegas);
  const [trabajadores, setTrabajadores] = useState(mockTrabajadores);

  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);

  // `menuOpen` guarda el id_bodega del menú ⋮ abierto, o null si ninguno.
  const [menuOpen, setMenuOpen] = useState(null);

  // `editando` guarda el id_bodega que se está editando (null en creación).
  const [editando, setEditando]       = useState(null);
  // `initialData` contiene los valores normalizados para pre-llenar el formulario.
  const [initialData, setInitialData] = useState(null);

  // `confirmDelete` almacena la bodega pendiente de eliminar.
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Carga inicial de datos ────────────────────────────────────────────────
  // `bodegas` y `trabajadores` se solicitan en paralelo al montar.
  // El catch vacío de cada llamada preserva los datos mock si el endpoint falla.
  useEffect(() => {
    api.get('/bodegas')
      .then(({ data }) => { console.log('GET /api/bodegas →', data); setBodegas(data); })
      .catch(() => {});

    api.get('/trabajadores')
      .then(({ data }) => setTrabajadores(data))
      .catch(() => {});
  }, []);

  // ── Filtro de búsqueda en tiempo real ────────────────────────────────────
  // Filtra sobre el array en memoria por descripción y ciudad.
  const filtered = bodegas.filter(
    (b) =>
      (b.descripcion ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.ciudad ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Cierra el modal y limpia el estado de edición para que la próxima
  // apertura del modal parta siempre en modo creación con formulario vacío.
  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setInitialData(null);
  };

  // Normaliza los campos de la bodega antes de pasarlos al formulario:
  // - Convierte capacidades a string para los inputs numéricos controlados.
  // - Usa `b.tipo_bodega ?? 'Seca'` como fallback por si el campo llega nulo.
  // - Convierte `b.activa` (TINYINT 1/0 de MySQL) a booleano con !! para que
  //   el checkbox quede correctamente marcado o desmarcado.
  // - Convierte el ID del trabajador a string para que coincida con el value
  //   del <option> correspondiente en el select.
  const openEdit = (b) => {
    setInitialData({
      descripcion:     b.descripcion,
      ubicacion:       b.ubicacion,
      ciudad:          b.ciudad,
      capacidadMaxima: String(b.capacidad_maxima ?? ''),
      capacidadActual: String(b.capacidad_actual ?? ''),
      tipo:            b.tipo_bodega ?? 'Seca',
      estado:          !!b.activa,
      trabajador:      String(b.usuario_trab_id_responsable ?? ''),
    });
    setEditando(b.id_bodega);
    setMenuOpen(null);
    setShowModal(true);
  };

  // ── Eliminación con confirmación ──────────────────────────────────────────
  // Se invoca solo cuando el usuario confirma en el banner.
  // 1. Cierra el banner de inmediato para evitar doble clic.
  // 2. Envía DELETE /bodegas/:id.
  // 3. Si tiene éxito, filtra la bodega del estado local sin recargar la lista.
  // 4. Si falla, muestra el mensaje del backend en un alert nativo.
  const handleConfirmDelete = async () => {
    const b = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/bodegas/${b.id_bodega}`);
      setBodegas((prev) => prev.filter((x) => x.id_bodega !== b.id_bodega));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'No se pudo eliminar la bodega.');
    }
  };

  // ── Guardar bodega (crear o editar) ───────────────────────────────────────
  const handleSave = async (form) => {
    const payload = {
      descripcion:                 form.descripcion,
      ubicacion:                   form.ubicacion,
      ciudad:                      form.ciudad,
      capacidad_maxima:            Number(form.capacidadMaxima),
      // `|| 0` evita NaN si el campo se deja vacío (capacidad actual es opcional).
      capacidad_actual:            Number(form.capacidadActual) || 0,
      // El valor del ENUM se envía tal cual; coincide con los literales que acepta MySQL.
      tipo_bodega:                 form.tipo,
      // Convierte el booleano del formulario al TINYINT que espera la columna `activa`.
      activa:                      form.estado ? 1 : 0,
      usuario_trab_id_responsable: Number(form.trabajador) || null,
    };
    try {
      if (editando) {
        await api.put(`/bodegas/${editando}`, payload);
      } else {
        await api.post('/bodegas', payload);
      }
      // Recarga la lista completa para reflejar los datos guardados por el servidor.
      const { data } = await api.get('/bodegas');
      setBodegas(data);
      closeModal();
    } catch {
      // Si la operación falla se cierra el modal sin mostrar detalles; errores
      // graves (p. ej. duplicados de descripción) se verían en consola de red.
      closeModal();
    }
  };

  // ── Barra de progreso de capacidad ───────────────────────────────────────
  // Calcula el porcentaje de ocupación de la bodega como entero entre 0 y 100.
  // - Si capacidad_maxima es 0 o undefined devuelve 0 para evitar división por cero.
  // - Math.round elimina decimales para que el label sea un número limpio.
  // - Math.min(100, ...) impide que la barra sobrepase su contenedor si
  //   capacidad_actual supera accidentalmente a capacidad_maxima.
  // El ancho de la barra de relleno se aplica como inline style `width: pct(b)%`
  // y el color cambia según el nivel de ocupación:
  //   < 70 % → verde (pFillGreen): capacidad disponible suficiente.
  //   70–89 % → amarillo (pFillYellow): empezando a llenarse.
  //   ≥ 90 % → rojo (pFillRed): casi a tope, requiere atención.
  const pct = (b) => {
    const actual = b.capacidad_actual ?? 0;
    const maxima = b.capacidad_maxima ?? 0;
    if (!maxima) return 0;
    return Math.min(100, Math.round((actual / maxima) * 100));
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por descripción o ciudad...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Resetea editando e initialData antes de abrir el modal para garantizar
            que siempre arranque en modo creación cuando se usa este botón. */}
        <button className={styles.btnNew} onClick={() => { setEditando(null); setInitialData(null); setShowModal(true); }}>
          + Agregar Bodega
        </button>
      </div>

      {/* ── Banner de confirmación de eliminación ────────────────────────────
          Se monta cuando `confirmDelete` tiene una bodega pendiente.
          "Confirmar" ejecuta handleConfirmDelete; "Cancelar" limpia
          confirmDelete sin enviar ninguna petición. */}
      {confirmDelete && (
        <div className={styles.confirmBanner}>
          <span>¿Eliminar la bodega <strong>{confirmDelete.descripcion}</strong>? Esta acción no se puede deshacer.</span>
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
              <th>Descripción</th>
              <th>Ubicación</th>
              <th>Ciudad</th>
              <th>Cap. Máxima</th>
              <th>Cap. Actual</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id_bodega}>
                <td className={styles.mono}>{b.id_bodega}</td>
                <td className={styles.nombre}>{b.descripcion}</td>
                <td className={styles.small}>{b.ubicacion}</td>
                <td>{b.ciudad}</td>
                <td>{(b.capacidad_maxima ?? 0).toLocaleString()}</td>
                <td>
                  {/*
                    Barra de progreso de capacidad actual.
                    La barra contenedora (progressBar) tiene ancho fijo en CSS.
                    La barra de relleno (progressFill) recibe su ancho como inline
                    style calculado por pct(b), y una clase de color condicional
                    según los umbrales de 70 % y 90 %.
                    El label muestra la capacidad actual formateada con separador de
                    miles y el porcentaje entre paréntesis.
                  */}
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div
                        className={`${styles.progressFill} ${
                          pct(b) >= 90 ? styles.pFillRed
                            : pct(b) >= 70 ? styles.pFillYellow
                            : styles.pFillGreen
                        }`}
                        style={{ width: `${pct(b)}%` }}
                      />
                    </div>
                    <span className={styles.pctLabel}>
                      {(b.capacidad_actual ?? 0).toLocaleString()} ({pct(b)}%)
                    </span>
                  </div>
                </td>
                <td>
                  {/* El valor del ENUM se muestra directamente; el badge CSS
                      le da el estilo visual sin necesidad de mapeo adicional. */}
                  <span className={styles.tipoBadge}>{b.tipo_bodega}</span>
                </td>
                <td>
                  {/* `b.activa` viene del backend como TINYINT (1/0) o boolean;
                      el operador ternario evalúa el valor como truthy/falsy
                      para elegir la clase de color y el texto del badge. */}
                  <span className={b.activa ? styles.estadoActive : styles.estadoInactive}>
                    {b.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className={styles.menuCell}>
                  {/*
                    Menú de tres puntos exclusivo para administradores.
                    El toggle compara menuOpen con el ID de la bodega actual:
                    si ya está abierto lo cierra, si no lo abre.
                    No hay listener global de click-outside en este componente;
                    el menú se cierra al elegir una acción o al abrir el de otra fila.
                  */}
                  {isAdmin() && (
                    <div className={styles.menuWrap}>
                      <button
                        className={styles.menuBtn}
                        onClick={() => setMenuOpen(menuOpen === b.id_bodega ? null : b.id_bodega)}
                      >⋮</button>
                      {menuOpen === b.id_bodega && (
                        <div className={styles.dropdown}>
                          <button onClick={() => openEdit(b)}>✏️ Editar</button>
                          <button
                            className={styles.dangerItem}
                            onClick={() => { setConfirmDelete(b); setMenuOpen(null); }}
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
        {filtered.length === 0 && <p className={styles.empty}>No se encontraron bodegas.</p>}
      </div>

      {/* El modal se monta condicionalmente. `isEdit` se deriva de !!editando
          para que el modal conozca su modo sin recibir el ID directamente. */}
      {showModal && (
        <BodegaModal
          onClose={closeModal}
          onSave={handleSave}
          trabajadores={trabajadores}
          initialData={initialData}
          isEdit={!!editando}
        />
      )}
    </div>
  );
}

export default Bodegas;
