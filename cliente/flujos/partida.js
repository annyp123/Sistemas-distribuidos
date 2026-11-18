const { preguntar, esperarLineaOTimeout } = require('../consola/entrada');
const { MS_ENTRE_CONSULTAS } = require('../configuracion');
const { nombreDe, participaEn, imprimirPartida } = require('../consola/pantalla');

// Consulta la partida cada tanto hasta que se cumpla `condicion`. Devuelve
// null si el usuario escribe "salir" antes de que ocurra.
async function esperarHasta(api, partidaId, condicion, mensaje) {
  console.log(mensaje);
  while (true) {
    const partida = await api.obtenerPartida(partidaId);
    if (condicion(partida)) return partida;
    const respuesta = await esperarLineaOTimeout(MS_ENTRE_CONSULTAS);
    if (respuesta === 'salir') return null;
  }
}

async function abandonarYRefrescar(api, partidaId) {
  await api.abandonarPartida(partidaId);
  return api.obtenerPartida(partidaId);
}

async function esperarRival(api, partidaId, usuarioId) {
  imprimirPartida(await api.obtenerPartida(partidaId), usuarioId);
  const partida = await esperarHasta(
    api,
    partidaId,
    (actual) => actual.estado !== 'SIN_COMPLETAR',
    'Esperando a que se una un rival... (escribe "salir" y Enter para dejar de esperar)'
  );
  if (!partida) {
    console.log('\nDejaste de esperar. La partida sigue abierta: retómala desde "Ver partidas".\n');
    return null;
  }
  console.log(`\n¡Se unió ${nombreDe(partida.unido)}! Comienza la partida.\n`);
  return partida;
}

// Pide un intento en tu turno. Devuelve la partida ya actualizada.
async function jugarMiTurno(api, partidaId) {
  const respuesta = await preguntar('Tu intento (4 dígitos distintos) o "salir" para abandonar: ');
  if (respuesta.toLowerCase() === 'salir') return abandonarYRefrescar(api, partidaId);

  try {
    const resultado = await api.jugarIntento(partidaId, respuesta);
    console.log(`\n-> Picas: ${resultado.picas}  Fijas: ${resultado.fijas}\n`);
  } catch (err) {
    console.log(`\n✖ ${err.message}\n`);
  }
  return api.obtenerPartida(partidaId);
}

// Flujo de un jugador que participa en la partida: espera rival, alterna
// turnos y muestra el resultado final.
async function jugarPartida(api, partidaId, usuarioId) {
  let partida = await api.obtenerPartida(partidaId);

  if (partida.estado === 'SIN_COMPLETAR') {
    partida = await esperarRival(api, partidaId, usuarioId);
    if (!partida) return;
  }

  while (partida.estado === 'EN_JUEGO') {
    imprimirPartida(partida, usuarioId);

    if (partida.turno_actual.id === usuarioId) {
      partida = await jugarMiTurno(api, partidaId);
      continue;
    }

    partida = await esperarHasta(
      api,
      partidaId,
      (actual) => actual.estado !== 'EN_JUEGO' || actual.turno_actual.id === usuarioId,
      `Esperando el turno de ${partida.turno_actual.nombre}... (escribe "salir" y Enter para abandonar la partida)`
    );
    if (!partida) partida = await abandonarYRefrescar(api, partidaId);
  }

  imprimirPartida(partida, usuarioId);
}

// Abre una partida: si participas, la juegas; si no, solo la miras.
async function abrirPartida(api, partidaId, usuarioId) {
  const partida = await api.obtenerPartida(partidaId);
  if (participaEn(partida, usuarioId)) {
    await jugarPartida(api, partidaId, usuarioId);
    return;
  }
  imprimirPartida(partida, usuarioId);
  await preguntar('\nEstás solo mirando esta partida. Enter para volver al menú...');
}

module.exports = { jugarPartida, abrirPartida };
