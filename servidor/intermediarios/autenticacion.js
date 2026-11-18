const conexion = require('../basedatos/conexion');
const { errorHttp, manejadorAsincrono } = require('../utilidades/errores');

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const autenticar = manejadorAsincrono(async (req, res, next) => {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw errorHttp(401, 'Falta el header Authorization: Bearer <token>');
  }
  // La columna es UUID: un token con otro formato haría fallar la consulta.
  if (!REGEX_UUID.test(token)) throw errorHttp(401, 'Token inválido');

  const { rows } = await conexion.query(
    'SELECT id, nombre FROM usuarios WHERE token = $1',
    [token]
  );
  if (rows.length === 0) throw errorHttp(401, 'Token inválido');

  req.usuario = rows[0];
  next();
});

module.exports = autenticar;
