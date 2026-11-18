const juegoServicio = require('../servicios/juego.servicio');
const { errorHttp, manejadorAsincrono } = require('../utilidades/errores');

const ID_MAXIMO = 2147483647; // límite del INTEGER de Postgres

function leerIdPartida(req) {
  const { id } = req.params;
  if (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > ID_MAXIMO) {
    throw errorHttp(400, 'El id de la partida no es válido');
  }
  return Number(id);
}

const crear = manejadorAsincrono(async (req, res) => {
  const partida = await juegoServicio.crearPartida(req.usuario.id, req.body.secreto);
  res.status(201).json(partida);
});

const unirse = manejadorAsincrono(async (req, res) => {
  const partida = await juegoServicio.unirsePartida(leerIdPartida(req), req.usuario.id, req.body.secreto);
  res.status(200).json(partida);
});

const jugar = manejadorAsincrono(async (req, res) => {
  const resultado = await juegoServicio.jugarTurno(leerIdPartida(req), req.usuario.id, req.body.intento);
  res.status(200).json(resultado);
});

const obtener = manejadorAsincrono(async (req, res) => {
  const partida = await juegoServicio.obtenerPartida(leerIdPartida(req), req.usuario.id);
  res.status(200).json(partida);
});

const listar = manejadorAsincrono(async (req, res) => {
  const partidas = await juegoServicio.listarPartidas(req.query.estado);
  res.status(200).json(partidas);
});

const abandonar = manejadorAsincrono(async (req, res) => {
  await juegoServicio.abandonarPartida(leerIdPartida(req), req.usuario.id);
  res.status(200).json({ ok: true });
});

module.exports = { crear, unirse, jugar, obtener, listar, abandonar };
