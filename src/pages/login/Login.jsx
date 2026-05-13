// Página de autenticación. Es la única ruta pública de la aplicación;
// si el usuario ya tiene sesión activa, PrivateRoute en App.jsx
// lo redirige al dashboard antes de llegar aquí.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import styles from './Login.module.css';

function Login() {
  const navigate = useNavigate();

  // Estado del formulario: un solo objeto agrupa ambos campos para que
  // handleChange pueda actualizar cualquiera de ellos con un único handler.
  const [form, setForm]       = useState({ user_name: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Handler genérico de cambio para todos los inputs del formulario.
  // Usa la propiedad calculada [e.target.name] para actualizar solo el campo
  // que disparó el evento, y limpia el mensaje de error previo en cada pulsación
  // para que el usuario no vea errores obsoletos mientras escribe.
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Envía las credenciales al endpoint del backend.
      // Si la autenticación es exitosa, el servidor devuelve { token, user }.
      const { data } = await api.post('/auth/login', {
        user_name: form.user_name,
        password:  form.password,
      });

      // Persiste el JWT y el objeto de usuario en localStorage para que
      // el interceptor de Axios (api.js) pueda adjuntar el token a cada
      // petición y para que useRole pueda leer el campo `cargo`.
      localStorage.setItem('siape_token', data.token);
      localStorage.setItem('siape_user', JSON.stringify(data.user));

      // Redirige al dashboard tras el login exitoso.
      // El control de acceso a rutas restringidas (Trabajadores, Reportes)
      // lo maneja AdminRoute en App.jsx según el cargo guardado en localStorage.
      navigate('/dashboard');

    } catch {
      // Fallback de credenciales mock para desarrollo o cuando el backend
      // no está disponible. Simula la misma estructura de datos que devuelve
      // el servidor real (token + objeto user con user_name y cargo).
      if (form.user_name === 'admin' && form.password === '123456') {
        localStorage.setItem('siape_token', 'mock-token-123');
        localStorage.setItem(
          'siape_user',
          JSON.stringify({ user_name: 'admin', cargo: 'Administrador' })
        );
        navigate('/dashboard');
      } else {
        // Cualquier otro error (credenciales incorrectas, red caída, etc.)
        // muestra un mensaje genérico para no revelar si el usuario existe.
        setError('Usuario o contraseña incorrectos.');
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.page}>
      {/* Panel izquierdo: presentación del sistema con las funcionalidades destacadas */}
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <h1 className={styles.brand}>SIAPE</h1>
          <p className={styles.brandSub}>Sistema de Gestión Empresarial</p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📦</span>
              <div>
                <strong>Control de Inventario</strong>
                <p>Gestiona tu stock en tiempo real</p>
              </div>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📊</span>
              <div>
                <strong>Reportes de Ventas</strong>
                <p>Analiza el rendimiento de tu negocio</p>
              </div>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🏭</span>
              <div>
                <strong>Gestión de Proveedores</strong>
                <p>Centraliza tus relaciones comerciales</p>
              </div>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>💳</span>
              <div>
                <strong>Control de Pagos</strong>
                <p>Registra y monitorea tus transacciones</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho: formulario de autenticación */}
      <div className={styles.right}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Iniciar Sesión</h2>
            <p className={styles.formSub}>Ingresa tus credenciales para continuar</p>
          </div>

          {/* El formulario es controlado: cada input refleja su valor desde el estado
              y actualiza el estado en cada cambio a través de handleChange. */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='user_name'>
                Usuario
              </label>
              <input
                id='user_name'
                name='user_name'
                type='text'
                className={styles.input}
                placeholder='nombre de usuario'
                value={form.user_name}
                onChange={handleChange}
                required
                autoComplete='username'
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor='password'>
                Contraseña
              </label>
              <input
                id='password'
                name='password'
                type='password'
                className={styles.input}
                placeholder='••••••••'
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {/* El mensaje de error se muestra solo cuando hay contenido en `error`.
                Se limpia automáticamente con cada pulsación de tecla en los inputs. */}
            {error && <div className={styles.error}>{error}</div>}

            {/* El botón se deshabilita durante la petición para evitar envíos duplicados
                y cambia su texto para informar al usuario que se está procesando. */}
            <button type='submit' className={styles.submitBtn} disabled={loading}>
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default Login;
