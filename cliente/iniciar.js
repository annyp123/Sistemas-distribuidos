const { crearClienteApi } = require('./clienteApi');
const { preguntar, cerrarEntrada } = require('./consola/entrada');
const { imprimirMenu } = require('./consola/pantalla');
const { accionIniciarSesion, accionCrearPartida, accionVerPartidas } = require('./flujos/acciones');

function exigirSesion(sesion) {
  if (!sesion.token) throw new Error('Primero inicia sesión con la opción 1');
}

async function ejecutarOpcion(opcion, api, sesion) {
  switch (opcion) {
    case '1':
      await accionIniciarSesion(api, sesion);
      return;
    case '2':
      exigirSesion(sesion);
      await accionCrearPartida(api, sesion);
      return;
    case '3':
      exigirSesion(sesion);
      await accionVerPartidas(api, sesion);
      return;
    default:
      console.log('\nOpción inválida\n');
  }
}

async function main() {
  const sesion = { token: null, id: null, nombre: null };
  const api = crearClienteApi(() => sesion.token);

  while (true) {
    imprimirMenu(sesion);
    const opcion = await preguntar('> ');
    if (opcion === '0') {
      cerrarEntrada();
      return;
    }
    try {
      await ejecutarOpcion(opcion, api, sesion);
    } catch (err) {
      console.log(`\n✖ ${err.message}\n`);
    }
  }
}

main();
