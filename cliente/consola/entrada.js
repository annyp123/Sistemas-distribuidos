const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const lectura = readline.createInterface({ input: stdin, output: stdout });

async function preguntar(texto) {
  return (await lectura.question(texto)).trim();
}

// Espera hasta `ms` por una línea que el usuario escriba, sin dibujar ningún
// prompt (a diferencia de `preguntar`, que redibuja la línea cada vez que se
// llama). Si no escribe nada a tiempo, resuelve con null y no queda ningún
// listener colgado.
function esperarLineaOTimeout(ms) {
  return new Promise((resolver) => {
    let resuelto = false;

    function alRecibirLinea(texto) {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(temporizador);
      resolver(texto.trim().toLowerCase());
    }

    const temporizador = setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      lectura.removeListener('line', alRecibirLinea);
      resolver(null);
    }, ms);

    lectura.once('line', alRecibirLinea);
  });
}

function cerrarEntrada() {
  lectura.close();
}

module.exports = { preguntar, esperarLineaOTimeout, cerrarEntrada };
