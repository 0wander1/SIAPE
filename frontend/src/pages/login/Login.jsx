import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import styles from './Login.module.css';

function Login() {
  const navigate = useNavigate();

  // step: 'credentials' → formulario usuario/contraseña
  //       'code'        → formulario código de verificación
  const [step, setStep]       = useState('credentials');
  const [userId, setUserId]   = useState(null);

  const [form, setForm]       = useState({ user_name: '', password: '' });
  const [codigo, setCodigo]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // Paso 1: valida credenciales. El backend responde { userId } sin token;
  // guardamos el userId y mostramos el formulario del código.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', {
        user_name: form.user_name,
        password:  form.password,
      });
      setUserId(data.userId);
      setStep('code');
    } catch {
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: envía el código de verificación. Si el backend responde con el token
  // lo persiste en localStorage y redirige al dashboard.
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-code', { userId, codigo });
      localStorage.setItem('siape_token', data.token);
      localStorage.setItem('siape_user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch {
      setError('Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Panel izquierdo: presentación del sistema */}
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

      {/* Panel derecho: cambia entre el formulario de credenciales y el de código */}
      <div className={styles.right}>
        <div className={styles.formCard}>

          {step === 'credentials' && (
            <>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>Iniciar Sesión</h2>
                <p className={styles.formSub}>Ingresa tus credenciales para continuar</p>
              </div>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor='user_name'>Usuario</label>
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
                  <label className={styles.label} htmlFor='password'>Contraseña</label>
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
            </>
          )}

          {step === 'code' && (
            <>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>Verificación</h2>
                <p className={styles.formSub}>Ingresa el código de 6 dígitos enviado a tu correo</p>
              </div>
              <form onSubmit={handleVerify} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor='codigo'>Código</label>
                  <input
                    id='codigo'
                    name='codigo'
                    type='text'
                    inputMode='numeric'
                    maxLength={6}
                    className={styles.input}
                    placeholder='000000'
                    value={codigo}
                    onChange={(e) => { setCodigo(e.target.value); setError(''); }}
                    required
                    autoComplete='one-time-code'
                    autoFocus
                  />
                </div>
                {error && <div className={styles.error}>{error}</div>}
                <button type='submit' className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>
                <button
                  type='button'
                  className={styles.submitBtn}
                  style={{ background: 'transparent', color: '#6b7280', boxShadow: 'none', marginTop: -8 }}
                  onClick={() => { setStep('credentials'); setError(''); setCodigo(''); }}
                >
                  ← Volver
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default Login;
