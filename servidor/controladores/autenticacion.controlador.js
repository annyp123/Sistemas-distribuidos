const { randomUUID } = require('node:crypto');
const conexion = require('../basedatos/conexion');
const { errorHttp, manejadorAsincrono } = require('../utilidades/errores');

const iniciarSesion = manejadorAsincrono(async (req, res) => {
  const { usuario } = req.body;
  if (typeof usuario !== 'string' || usuario.trim().length === 0) {
    throw errorHttp(400, 'El campo "usuario" es requerido');
  }

  const { rows } = await conexion.query(
    `INSERT INTO usuarios (nombre, token) VALUES ($1, $2)
     ON CONFLICT (nombre) DO UPDATE SET token = EXCLUDED.token
     RETURNING id, nombre, token`,
    [usuario.trim(), randomUUID()]
  );

  const fila = rows[0];
  res.status(201).json({ id: fila.id, usuario: fila.nombre, token: fila.token });
});

module.exports = { iniciarSesion };
