const { URL_API } = require('./configuracion');

function crearClienteApi(obtenerToken) {
  async function llamar(metodo, ruta, cuerpo) {
    const cabeceras = { 'Content-Type': 'application/json' };
    const token = obtenerToken();
    if (token) cabeceras.Authorization = `Bearer ${token}`;

    let respuesta;
    try {
      respuesta = await fetch(`${URL_API}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch (err) {
      const detalle = err.cause?.message || err.message;
      throw new Error(`No se pudo conectar con la API en ${URL_API} (${detalle})`);
    }

    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || `Error HTTP ${respuesta.status}`);
    return datos;
  }

  return {
    iniciarSesion: (usuario) => llamar('POST', '/login', { usuario }),
    crearPartida: (secreto) => llamar('POST', '/juego', { secreto }),
    unirsePartida: (id, secreto) => llamar('PUT', `/juego/${id}`, { secreto }),
    jugarIntento: (id, intento) => llamar('POST', `/juego/${id}/jugar`, { intento }),
    abandonarPartida: (id) => llamar('POST', `/juego/${id}/abandonar`),
    obtenerPartida: (id) => llamar('GET', `/juego/${id}`),
    listarPartidas: (estado) => llamar('GET', estado ? `/juego?estado=${estado}` : '/juego'),
  };
}

module.exports = { crearClienteApi };
