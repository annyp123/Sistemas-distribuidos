const express = require('express');
const { iniciarSesion } = require('../controladores/autenticacion.controlador');

const rutas = express.Router();
rutas.post('/login', iniciarSesion);

module.exports = rutas;
