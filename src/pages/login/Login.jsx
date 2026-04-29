import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import styles from './Login.module.css';

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', {
        email: form.email,
        password: form.password,
      });
      localStorage.setItem('siape_token', data.token);
      localStorage.setItem('siape_user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch {
      // Fallback a credenciales mock
      if (form.email === 'admin@siape.com' && form.password === '123456') {
        localStorage.setItem('siape_token', 'mock-token-123');
        localStorage.setItem(
          'siape_user',
          JSON.stringify({ name: 'Administrador', role: 'Administrador', email: form.email })
        );
        navigate('/dashboard');
      } else {
        setError('Correo o contraseña incorrectos.');
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.page}>
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

      <div className={styles.right}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Iniciar Sesión</h2>
            <p className={styles.formSub}>Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='email'>
                Correo Electrónico
              </label>
              <input
                id='email'
                name='email'
                type='email'
                className={styles.input}
                placeholder='correo@empresa.com'
                value={form.email}
                onChange={handleChange}
                required
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

            {error && <div className={styles.error}>{error}</div>}

            <button type='submit' className={styles.submitBtn} disabled={loading}>
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className={styles.hint}>
            Demo: <strong>admin@siape.com</strong> / <strong>123456</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
