const { Pool } = require('pg');

const conexion = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'picasyfijas',
  password: process.env.DB_PASSWORD || 'picasyfijas',
  database: process.env.DB_NAME || 'picasyfijas',
});

// Sin este listener, si Postgres se cae o se reinicia, el error de una
// conexión inactiva tumba todo el proceso.
conexion.on('error', (err) => console.error('Error en conexión inactiva de Postgres:', err.message));

module.exports = conexion;
