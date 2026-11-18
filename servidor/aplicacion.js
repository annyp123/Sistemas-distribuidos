const express = require('express');
const rutasAutenticacion = require('./rutas/autenticacion.rutas');
const rutasJuego = require('./rutas/juego.rutas');
const manejarErrores = require('./intermediarios/manejoErrores');

const aplicacion = express();
aplicacion.use(express.json());

aplicacion.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

aplicacion.use(rutasAutenticacion);
aplicacion.use(rutasJuego);

aplicacion.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));
aplicacion.use(manejarErrores);

module.exports = aplicacion;
