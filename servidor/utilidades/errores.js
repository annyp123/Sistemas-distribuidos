function errorHttp(estado, mensaje) {
  const error = new Error(mensaje);
  error.status = estado;
  return error;
}

// Express 4 no atrapa los errores de handlers async: sin esto, una promesa
// rechazada (p. ej. la base de datos caída) tumba el proceso.
const manejadorAsincrono = (funcion) => (req, res, next) =>
  Promise.resolve(funcion(req, res, next)).catch(next);

module.exports = { errorHttp, manejadorAsincrono };
