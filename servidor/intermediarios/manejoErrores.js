// Los 4 parámetros son obligatorios: así Express lo reconoce como manejador de errores.
function manejarErrores(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El body no es un JSON válido' });
  }

  const estado = err.status || 500;
  if (estado >= 500) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
  res.status(estado).json({ error: err.message });
}

module.exports = manejarErrores;
