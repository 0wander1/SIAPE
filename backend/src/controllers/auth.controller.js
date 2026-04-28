const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const { user_name, password } = req.body;

    if (!user_name || !password) {
      return res.status(400).json({ message: 'user_name y password son requeridos.' });
    }

    const result = await authService.login(user_name, password);

    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { login };
