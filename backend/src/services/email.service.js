// Servicio de envío de correos electrónicos transaccionales mediante nodemailer.
// Usa Gmail como servidor SMTP con autenticación a través de las variables de entorno
// GMAIL_USER (dirección del remitente) y GMAIL_PASS (contraseña de aplicación de Google).
// Este servicio solo envía correos; no almacena registros ni gestiona reintentos.
const nodemailer = require('nodemailer');

// Envía un correo HTML al destinatario indicado con el código de verificación de seis dígitos.
// Se usa durante el segundo paso del login (auth.controller → auth.service → aquí) para
// que el trabajador confirme su identidad antes de recibir el JWT.
//
// Parámetros:
//   correo — dirección de destino obtenida del registro del trabajador en la BD.
//   codigo — string de 6 dígitos generado por authService.generateCode().
//
// Configuración SMTP:
//   port: 587 con secure: false y requireTLS: true implementa el protocolo STARTTLS:
//   la conexión comienza sin cifrado en el puerto 587 y luego se eleva a TLS mediante
//   el comando STARTTLS antes de enviar las credenciales. Es la alternativa estándar
//   al puerto 465 (SSL directo). Gmail exige STARTTLS en el puerto 587; usar
//   secure: true en ese puerto causaría un error de negociación TLS.
//
//   connectionTimeout y greetingTimeout en 10 000 ms evitan que la función quede
//   colgada indefinidamente si Gmail no responde (red lenta, servicio caído, etc.).
//   Sin estos límites un envío fallido bloquearía el event loop de Node durante
//   el tiempo de espera por defecto del sistema operativo (que puede ser de minutos).
//
//   Se crea un transporter nuevo en cada llamada en lugar de reutilizar uno global
//   porque las llamadas son infrecuentes (una por login) y la simplicidad supera
//   el coste marginal de instanciar el objeto cada vez.
//
// Comportamiento ante errores:
//   Si sendMail lanza una excepción (credenciales inválidas, destinatario rechazado,
//   timeout de red, etc.) este servicio la registra en consola y la vuelve a lanzar
//   para que el llamador decida cómo manejarla. En auth.controller el error se captura
//   en silencio porque la respuesta HTTP ya fue enviada (patrón fire-and-forget);
//   de este modo el fallo de correo no afecta al usuario ni bloquea el proceso de login.
async function sendVerificationCode(correo, codigo) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,      // false = STARTTLS en puerto 587, no SSL directo
    requireTLS: true,   // fuerza la elevación a TLS antes de enviar credenciales
    family: 4,          // fuerza IPv4 para evitar timeouts de conexión por IPv6
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    connectionTimeout: 10000,  // ms máximos para establecer la conexión TCP
    greetingTimeout:   10000,  // ms máximos para recibir el saludo SMTP del servidor
  });

  try {
    await transporter.sendMail({
      from:    `"SIAPE" <${process.env.GMAIL_USER}>`,
      to:      correo,
      subject: 'Código de verificación SIAPE',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="margin:0 0 16px;color:#111827">Código de verificación</h2>
          <p style="margin:0 0 24px;color:#6b7280">Usa el siguiente código para continuar. Expira en 10 minutos.</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;text-align:center;padding:16px;background:#f3f4f6;border-radius:6px">
            ${codigo}
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Si no solicitaste este código, ignora este mensaje.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error nodemailer:', error);
    throw error;
  }
}

module.exports = { sendVerificationCode };
