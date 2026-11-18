const express = require('express');
const autenticar = require('../intermediarios/autenticacion');
const juegoControlador = require('../controladores/juego.controlador');

const rutas = express.Router();

rutas.post('/juego', autenticar, juegoControlador.crear);
rutas.get('/juego', autenticar, juegoControlador.listar);
rutas.get('/juego/:id', autenticar, juegoControlador.obtener);
rutas.put('/juego/:id', autenticar, juegoControlador.unirse);
rutas.post('/juego/:id/jugar', autenticar, juegoControlador.jugar);
rutas.post('/juego/:id/abandonar', autenticar, juegoControlador.abandonar);

module.exports = rutas;
