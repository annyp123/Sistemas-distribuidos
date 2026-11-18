const { URL_API } = require('../configuracion');

const SEPARADOR_DOBLE = '='.repeat(44);
const SEPARADOR_SIMPLE = '-'.repeat(44);

function limpiarPantalla() {
  try {
    console.clear();
  } catch {
    // algunas terminales no soportan limpiar pantalla; seguimos sin eso
  }
}

function nombreDe(persona) {
  return persona ? persona.nombre : '(nadie)';
}

function participaEn(partida, usuarioId) {
  return partida.creador.id === usuarioId || (partida.unido !== null && partida.unido.id === usuarioId);
}

function imprimirPartida(partida, usuarioId) {
  limpiarPantalla();
  console.log(SEPARADOR_DOBLE);
  console.log(`Partida #${partida.id} — ${partida.estado}`);

  if (partida.unido) {
    console.log(`Jugadores: ${nombreDe(partida.creador)} vs ${nombreDe(partida.unido)}`);
  } else {
    console.log(`Creador: ${nombreDe(partida.creador)} — esperando rival...`);
  }

  if (partida.estado === 'EN_JUEGO' && partida.turno_actual) {
    const esMiTurno = partida.turno_actual.id === usuarioId;
    console.log(`Turno actual: ${partida.turno_actual.nombre}${esMiTurno ? ' (¡tu turno!)' : ''}`);
  }

  console.log('Tus intentos (adivinando el número del rival):');
  if (partida.intentos.length === 0) {
    console.log('  (todavía no has jugado ninguno)');
  } else {
    for (const intento of partida.intentos) {
      console.log(`  ${intento.intento}  ->  picas: ${intento.picas}, fijas: ${intento.fijas}`);
    }
  }

  if (partida.estado === 'TERMINADO' && partida.ganador) {
    const gane = partida.ganador.id === usuarioId;
    console.log(SEPARADOR_SIMPLE);
    console.log(`Ganó: ${partida.ganador.nombre}${gane ? ' (¡tú!)' : ''}`);
    console.log(
      partida.termino_por_abandono ? 'La partida terminó por abandono.' : 'Adivinó el número correctamente.'
    );
    if (partida.secretos) {
      console.log(`Número de ${nombreDe(partida.creador)}: ${partida.secretos.creador}`);
      console.log(`Número de ${nombreDe(partida.unido)}: ${partida.secretos.unido}`);
    }
  }
  console.log(SEPARADOR_DOBLE);
}

function imprimirListaPartidas(partidas, usuarioId) {
  for (const partida of partidas) {
    const rival = partida.unido ? partida.unido.nombre : '(nadie todavía)';
    const marcaMia = participaEn(partida, usuarioId) ? ' [mía]' : '';
    const ganador = partida.ganador ? ` — ganó: ${partida.ganador.nombre}` : '';
    console.log(
      `  #${partida.id} — ${partida.estado} — creó: ${partida.creador.nombre} — rival: ${rival}${ganador}${marcaMia}`
    );
  }
}

function imprimirMenu(sesion) {
  const sesionTexto = sesion.token ? `${sesion.nombre} (id ${sesion.id})` : '(sin sesión)';
  console.log('\n=== Picas y Fijas ===');
  console.log(`Sesión: ${sesionTexto}    API: ${URL_API}`);
  console.log('1) Iniciar sesión');
  console.log('2) Crear partida');
  console.log('3) Ver partidas (unirme, continuar o mirar)');
  console.log('0) Salir');
}

module.exports = { limpiarPantalla, nombreDe, participaEn, imprimirPartida, imprimirListaPartidas, imprimirMenu };
