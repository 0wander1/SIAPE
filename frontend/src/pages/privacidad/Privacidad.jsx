// Página pública con la política de tratamiento de datos personales.
// Reutiliza las clases de título, subtítulo y botón de Login.module.css; el resto
// del diseño usa estilos en línea con la misma paleta del proyecto.
import { Link } from 'react-router-dom';
import styles from '../login/Login.module.css';

const SECCIONES = [
  {
    titulo: 'Responsable del tratamiento',
    texto: 'SIAPE, con domicilio en Funza, Cundinamarca, Colombia. Correo de contacto: hecgrid00@gmail.com.',
  },
  {
    titulo: 'Datos que se recolectan',
    texto: 'SIAPE trata datos de identificación y contacto de trabajadores, clientes y proveedores: nombre, correo electrónico, celular, dirección, cargo, turno, nombre de usuario y NIT (que en el caso de una persona natural puede coincidir con su cédula). También trata datos del negocio y datos de uso de la cuenta, como el inicio de sesión y los códigos de verificación enviados por correo. Las contraseñas se almacenan cifradas y no son visibles para nadie. SIAPE no recolecta datos sensibles ni datos de menores de edad. Los campos de texto libre (observaciones y PQRS) no deben usarse para escribir datos sensibles.',
  },
  {
    titulo: 'Finalidad del tratamiento',
    texto: 'Los datos se usan para gestionar inventario, bodegas, productos, pedidos, facturas y pagos; autenticar a los usuarios; atender peticiones, quejas, reclamos y sugerencias (PQRS); y enviar códigos de verificación y notificaciones por correo. No se usan para publicidad ni se venden a terceros.',
  },
  {
    titulo: 'Derechos del titular',
    texto: 'El titular de los datos puede conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización otorgada; ser informado sobre el uso que se les ha dado; presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la Ley 1581 de 2012; revocar la autorización o solicitar la supresión de sus datos cuando proceda; y acceder de forma gratuita a sus datos personales.',
  },
  {
    titulo: 'Consultas y reclamos',
    texto: 'Las consultas y reclamos se atienden en el correo hecgrid00@gmail.com o por el módulo PQRS de la aplicación. Las consultas se responden en un máximo de 10 días hábiles, prorrogables por 5 días hábiles más, y los reclamos en un máximo de 15 días hábiles, prorrogables por 8 días hábiles más, conforme a los artículos 14 y 15 de la Ley 1581 de 2012.',
  },
  {
    titulo: 'Seguridad y terceros',
    texto: 'Los datos se almacenan y procesan con servicios de infraestructura en la nube: alojamiento del servidor y de la base de datos, alojamiento de la aplicación web y envío de correo transaccional. Estos proveedores pueden operar fuera de Colombia. El acceso se controla por roles y la autenticación requiere verificación por correo. La sesión se guarda en el navegador del usuario y expira a las 8 horas.',
  },
  {
    titulo: 'Vigencia y cambios',
    texto: 'Esta política rige desde el 14 de noviembre de 2026. Los datos se conservan mientras sean necesarios para las finalidades descritas. Cualquier cambio se publicará en esta misma página.',
  },
];

// Con sesión activa vuelve al dashboard; sin sesión (o si localStorage falla), al login.
function rutaVolver() {
  try {
    return localStorage.getItem('siape_token') !== null ? '/dashboard' : '/login';
  } catch {
    return '/login';
  }
}

function Privacidad() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '32px 16px' }}>
      <article
        style={{
          maxWidth: 760,
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 'clamp(20px, 5vw, 40px)',
        }}
      >
        <header style={{ marginBottom: 28 }}>
          <h1 className={styles.formTitle}>Política de tratamiento de datos personales de SIAPE</h1>
          <p className={styles.formSub}>Vigente desde el 14 de noviembre de 2026</p>
        </header>

        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {SECCIONES.map((s, i) => (
            <li key={s.titulo}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                {i + 1}. {s.titulo}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: '#374151', overflowWrap: 'anywhere' }}>
                {s.texto}
              </p>
            </li>
          ))}
        </ol>

        <Link
          to={rutaVolver()}
          className={styles.submitBtn}
          style={{ display: 'inline-block', marginTop: 32, padding: '11px 22px', fontSize: 14 }}
        >
          Volver
        </Link>
      </article>
    </div>
  );
}

export default Privacidad;
