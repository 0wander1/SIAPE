// jsonwebtoken es la librería que permite firmar y verificar JSON Web Tokens (JWT).
// Un JWT es una cadena compacta con tres partes separadas por puntos:
//   HEADER.PAYLOAD.SIGNATURE
// El header indica el algoritmo de firma, el payload lleva los datos del usuario
// (id, rol, etc.) y la firma garantiza que nadie alteró el contenido sin conocer el secreto.
const jwt = require('jsonwebtoken');

// verifyToken es un middleware de Express: recibe (req, res, next) y decide si la
// petición puede continuar hacia la ruta protegida o debe rechazarse aquí mismo.
// Se usa aplicándolo a rutas individuales o a grupos de rutas completos:
//   router.get('/ruta-protegida', verifyToken, controlador)
function verifyToken(req, res, next) {
  // El estándar HTTP define que las credenciales de autenticación viajan en el header
  // "Authorization". Se lee en minúsculas porque los nombres de headers HTTP son
  // insensibles a mayúsculas y Express los normaliza a minúsculas internamente.
  const authHeader = req.headers['authorization'];

  // El esquema Bearer tiene el formato: "Bearer <token>"
  // Ejemplo real: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  // split(' ') divide la cadena por el espacio y [1] toma el segundo elemento,
  // es decir, el token en sí, descartando la palabra "Bearer".
  // Si authHeader es undefined (header ausente), el operador && cortocircuita
  // y token queda como undefined sin lanzar un error de acceso a propiedad nula.
  const token = authHeader && authHeader.split(' ')[1];

  // Si el token no existe (header ausente, mal formado o sin la parte Bearer)
  // se responde HTTP 401 Unauthorized: el cliente no proporcionó credenciales.
  // El "return" impide que la función continúe y que se llame accidentalmente a next().
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado.' });
  }

  try {
    // jwt.verify() realiza dos operaciones simultáneas:
    //   1. Valida la firma usando JWT_SECRET (la clave secreta del servidor guardada en .env).
    //      Si alguien modificó el payload o usó un secreto distinto, la firma no coincide.
    //   2. Comprueba la fecha de expiración (campo "exp" del payload); si el token ya venció
    //      lanza un error TokenExpiredError aunque la firma sea válida.
    // Si ambas validaciones pasan, devuelve el payload decodificado como objeto JavaScript.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Se adjunta el payload decodificado a req.user para que los controladores posteriores
    // puedan acceder a los datos del usuario autenticado (id, rol, email, etc.)
    // sin necesidad de volver a consultar la base de datos.
    req.user = decoded;

    // next() transfiere el control al siguiente middleware o al controlador de la ruta.
    // Sin esta llamada la petición quedaría colgada y el cliente nunca recibiría respuesta.
    next();
  } catch (error) {
    // jwt.verify() lanza excepción en dos casos principales:
    //   - JsonWebTokenError: firma inválida, token manipulado o mal formado.
    //   - TokenExpiredError: el token era válido pero su tiempo de vida expiró.
    // En ambos casos se responde HTTP 403 Forbidden: las credenciales existen pero
    // no son aceptables (a diferencia de 401, donde directamente no se presentaron).
    return res.status(403).json({ message: 'Token inválido o expirado.' });
  }
}

// Se exporta verifyToken para que pueda importarse en cualquier router que necesite
// proteger sus rutas, manteniendo la lógica de autenticación en un único lugar.
module.exports = { verifyToken };
