const { preguntar } = require('../consola/entrada');
const { participaEn, imprimirListaPartidas } = require('../consola/pantalla');
const { jugarPartida, abrirPartida } = require('./partida');

const FILTROS_ESTADO = {
  1: { etiqueta: 'todas', estado: undefined },
  2: { etiqueta: 'sin completar', estado: 'SIN_COMPLETAR' },
  3: { etiqueta: 'en juego', estado: 'EN_JUEGO' },
  4: { etiqueta: 'terminadas', estado: 'TERMINADO' },
};

async function accionIniciarSesion(api, sesion) {
  const usuario = await preguntar('Nombre de usuario: ');
  const datos = await api.iniciarSesion(usuario);
  sesion.token = datos.token;
  sesion.id = datos.id;
  sesion.nombre = datos.usuario;
  console.log(`\nSesión iniciada como "${datos.usuario}" (id ${datos.id})\n`);
}

async function accionCrearPartida(api, sesion) {
  const secreto = await preguntar('Tu número secreto (4 dígitos distintos, ej. 1234): ');
  const partida = await api.crearPartida(secreto);
  console.log(`\nPartida #${partida.id} creada.\n`);
  await jugarPartida(api, partida.id, sesion.id);
}

async function unirseYJugar(api, sesion, partidaId) {
  const secreto = await preguntar('Tu número secreto (4 dígitos distintos, ej. 5678): ');
  await api.unirsePartida(partidaId, secreto);
  await jugarPartida(api, partidaId, sesion.id);
}

async function elegirFiltro() {
  console.log('\nFiltrar partidas:');
  for (const [numero, filtro] of Object.entries(FILTROS_ESTADO)) {
    console.log(`  ${numero}) ${filtro.etiqueta}`);
  }
  const opcion = await preguntar('Filtro (Enter = todas): ');
  return (FILTROS_ESTADO[opcion] || FILTROS_ESTADO[1]).estado;
}

// Lista las partidas y, según la que elijas por id: te unes (si espera rival
// y no es tuya), la continúas (si participas) o solo la miras.
async function accionVerPartidas(api, sesion) {
  const estado = await elegirFiltro();
  const partidas = await api.listarPartidas(estado);
  if (partidas.length === 0) {
    console.log('\nNo hay partidas con ese filtro.\n');
    return;
  }

  console.log('\nPartidas:');
  imprimirListaPartidas(partidas, sesion.id);

  const idTexto = await preguntar('\nId de la partida a abrir (Enter para volver al menú): ');
  if (!idTexto) return;

  const elegida = partidas.find((partida) => String(partida.id) === idTexto);
  if (!elegida) {
    console.log('\nEse id no está en la lista mostrada.\n');
    return;
  }

  if (elegida.estado === 'SIN_COMPLETAR' && !participaEn(elegida, sesion.id)) {
    await unirseYJugar(api, sesion, elegida.id);
  } else {
    await abrirPartida(api, elegida.id, sesion.id);
  }
}

module.exports = { accionIniciarSesion, accionCrearPartida, accionVerPartidas };
