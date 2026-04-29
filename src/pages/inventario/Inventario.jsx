import { useState, useEffect } from 'react';
import { mockInventario } from '../../utils/mockData.js';
import { formatDate } from '../../utils/format.js';
import api from '../../services/api.js';
import styles from './Inventario.module.css';

function Inventario() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState(mockInventario);
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    api.get('/inventario')
      .then(({ data }) => setItems(data))
      .catch(() => {});
  }, []);

  const filtered = items.filter(
    (item) =>
      item.nombre.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.proveedor.toLowerCase().includes(search.toLowerCase())
  );

  const stockStatus = (item) => {
    if (item.cantidadDisponible <= item.cantidadMinima * 0.5) return styles.statusCritical;
    if (item.cantidadDisponible <= item.cantidadMinima) return styles.statusLow;
    return styles.statusOk;
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            placeholder='Buscar por nombre, ID o proveedor...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button className={styles.btnOutline}>📄 Exportar Reporte</button>
          <button className={styles.btnOutline}>📂 Cargar Excel</button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID Producto</th>
              <th>Nombre</th>
              <th>ID Bodega</th>
              <th>Cant. Disponible</th>
              <th>Cant. Reservada</th>
              <th>Cant. Mínima</th>
              <th>Última Actualización</th>
              <th>Proveedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td className={styles.mono}>{item.id}</td>
                <td className={styles.productName}>{item.nombre}</td>
                <td>
                  <span className={styles.bodegaBadge}>Bodega {item.idBodega}</span>
                </td>
                <td>
                  <span className={`${styles.qty} ${stockStatus(item)}`}>
                    {item.cantidadDisponible}
                  </span>
                </td>
                <td>{item.cantidadReservada}</td>
                <td>{item.cantidadMinima}</td>
                <td>{formatDate(item.ultimaActualizacion)}</td>
                <td className={styles.provName}>{item.proveedor}</td>
                <td className={styles.menuCell}>
                  <div className={styles.menuWrap}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                    >
                      ⋮
                    </button>
                    {menuOpen === item.id && (
                      <div className={styles.dropdown}>
                        <button onClick={() => setMenuOpen(null)}>✏️ Editar</button>
                        <button onClick={() => setMenuOpen(null)}>📋 Ver historial</button>
                        <button className={styles.dangerItem} onClick={() => {
                          setItems(items.filter((i) => i.id !== item.id));
                          setMenuOpen(null);
                        }}>🗑️ Eliminar</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className={styles.empty}>No se encontraron productos.</p>
        )}
      </div>
    </div>
  );
}

export default Inventario;
