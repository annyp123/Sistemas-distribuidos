const REGEX_CUATRO_DIGITOS = /^\d{4}$/;

// Vale tanto para el secreto como para un intento: 4 dígitos, todos distintos.
function esNumeroValido(valor) {
  if (typeof valor !== 'string' || !REGEX_CUATRO_DIGITOS.test(valor)) return false;
  return new Set(valor.split('')).size === valor.length;
}

function calcularPicasYFijas(secreto, intento) {
  let fijas = 0;
  let coincidencias = 0;
  for (let i = 0; i < secreto.length; i++) {
    if (intento[i] === secreto[i]) fijas++;
    if (secreto.includes(intento[i])) coincidencias++;
  }
  return { picas: coincidencias - fijas, fijas };
}

module.exports = { esNumeroValido, calcularPicasYFijas };
