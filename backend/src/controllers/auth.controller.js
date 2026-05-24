const authService        = require('../services/auth.service');
const { sendVerificationCode } = require('../services/email.service');

// Paso 1 del login: valida credenciales, genera y envía el código de verificación.
// Ya no emite el JWT aquí — el token se genera en verifyCode una vez confirmado el código.
async function login(req, res, next) {
  try {
    const { user_name, password } = req.body;

    if (!user_name || !password) {
      return res.status(400).json({ message: 'user_name y password son requeridos.' });
    }

    const result = await authService.login(user_name, password);

    const codigo = authService.generateCode();
    authService.saveCode(result.user.id, codigo);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout enviando correo')), 15000)
    );
    await Promise.race([sendVerificationCode(result.correo, codigo), timeout]);

    return res.status(200).json({
      message: 'Código enviado a tu correo.',
      userId: result.user.id,
    });
  } catch (error) {
    next(error);
  }
}

// Paso 2 del login: valida el código recibido por correo y emite el JWT.
// userId viene del paso 1 (guardado por el cliente tras la primera respuesta).
async function verifyCode(req, res, next) {
  try {
    const { userId, codigo } = req.body;

    if (!userId || !codigo) {
      return res.status(400).json({ message: 'userId y codigo son requeridos.' });
    }

    const valido = authService.verifyCode(userId, codigo);
    if (!valido) {
      return res.status(401).json({ message: 'Código incorrecto o expirado.' });
    }

    const result = await authService.generateTokenForUser(userId);
    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token: result.token,
      user:  result.user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, verifyCode };
