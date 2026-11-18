const conexion = require('../basedatos/conexion');
const { esNumeroValido, calcularPicasYFijas } = require('../utilidades/picasFijas');
const { errorHttp } = require('../utilidades/errores');

const ESTADOS_VALIDOS = ['SIN_COMPLETAR', 'EN_JUEGO', 'TERMINADO'];

// Ejecuta `operacion(cliente)` dentro de una transacción y la cierra (commit/rollback).
async function conTransaccion(operacion) {
  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await operacion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

// Lee la partida bloqueando su fila: dos requests simultáneos (aunque lleguen
// a pods distintos) se serializan aquí.
async function bloquearPartida(cliente, partidaId) {
  const { rows } = await cliente.query('SELECT * FROM partidas WHERE id = $1 FOR UPDATE', [partidaId]);
  if (rows.length === 0) throw errorHttp(404, 'Partida no encontrada');
  return rows[0];
}

function personaONulo(id, nombre) {
  return id ? { id, nombre } : null;
}

async function crearPartida(creadorId, secreto) {
  if (!esNumeroValido(secreto)) {
    throw errorHttp(400, 'El secreto debe tener 4 dígitos distintos (0-9)');
  }

  const { rows } = await conexion.query(
    `INSERT INTO partidas (estado, creador_id, creador_secreto)
     VALUES ('SIN_COMPLETAR', $1, $2)
     RETURNING id, estado`,
    [creadorId, secreto]
  );
  return rows[0];
}

async function unirsePartida(partidaId, jugadorId, secreto) {
  if (!esNumeroValido(secreto)) {
    throw errorHttp(400, 'El secreto debe tener 4 dígitos distintos (0-9)');
  }

  return conTransaccion(async (cliente) => {
    const partida = await bloquearPartida(cliente, partidaId);
    if (partida.estado !== 'SIN_COMPLETAR') {
      throw errorHttp(409, 'La partida ya no acepta jugadores');
    }
    if (partida.creador_id === jugadorId) {
      throw errorHttp(400, 'No puedes unirte a tu propia partida');
    }

    const primerTurno = Math.random() < 0.5 ? partida.creador_id : jugadorId;

    const { rows } = await cliente.query(
      `UPDATE partidas
       SET unido_id = $1, unido_secreto = $2, estado = 'EN_JUEGO',
           turno_actual_id = $3, actualizado_en = now()
       WHERE id = $4
       RETURNING id, estado, turno_actual_id`,
      [jugadorId, secreto, primerTurno, partidaId]
    );
    return rows[0];
  });
}

async function jugarTurno(partidaId, jugadorId, intento) {
  if (!esNumeroValido(intento)) {
    throw errorHttp(400, 'El intento debe tener 4 dígitos distintos (0-9)');
  }

  return conTransaccion(async (cliente) => {
    const partida = await bloquearPartida(cliente, partidaId);
    if (partida.estado !== 'EN_JUEGO') {
      throw errorHttp(409, 'La partida no está en juego');
    }
    if (partida.turno_actual_id !== jugadorId) {
      throw errorHttp(403, 'No es tu turno');
    }

    const esCreador = jugadorId === partida.creador_id;
    const secretoRival = esCreador ? partida.unido_secreto : partida.creador_secreto;
    const rivalId = esCreador ? partida.unido_id : partida.creador_id;

    const { picas, fijas } = calcularPicasYFijas(secretoRival, intento);

    await cliente.query(
      `INSERT INTO intentos (partida_id, jugador_id, intento, picas, fijas)
       VALUES ($1, $2, $3, $4, $5)`,
      [partidaId, jugadorId, intento, picas, fijas]
    );

    const gano = fijas === 4;
    const estado = gano ? 'TERMINADO' : partida.estado;
    const ganadorId = gano ? jugadorId : partida.ganador_id;
    const siguienteTurno = gano ? partida.turno_actual_id : rivalId;

    await cliente.query(
      `UPDATE partidas
       SET estado = $1, ganador_id = $2, turno_actual_id = $3, actualizado_en = now()
       WHERE id = $4`,
      [estado, ganadorId, siguienteTurno, partidaId]
    );

    return { picas, fijas, estado, ganadorId };
  });
}

async function obtenerPartida(partidaId, usuarioId) {
  const { rows } = await conexion.query(
    `SELECT p.id, p.estado,
            p.creador_id, uc.nombre AS creador_nombre,
            p.unido_id, uu.nombre AS unido_nombre,
            p.turno_actual_id, ut.nombre AS turno_actual_nombre,
            p.ganador_id, ug.nombre AS ganador_nombre,
            CASE WHEN p.estado = 'TERMINADO' THEN p.creador_secreto END AS creador_secreto,
            CASE WHEN p.estado = 'TERMINADO' THEN p.unido_secreto END AS unido_secreto
     FROM partidas p
     JOIN usuarios uc ON uc.id = p.creador_id
     LEFT JOIN usuarios uu ON uu.id = p.unido_id
     LEFT JOIN usuarios ut ON ut.id = p.turno_actual_id
     LEFT JOIN usuarios ug ON ug.id = p.ganador_id
     WHERE p.id = $1`,
    [partidaId]
  );
  if (rows.length === 0) throw errorHttp(404, 'Partida no encontrada');
  const partida = rows[0];

  // Cada jugador solo ve SUS PROPIOS intentos (sus pistas sobre el secreto
  // del rival). Los intentos del rival son pistas sobre el secreto propio,
  // que el jugador ya conoce, así que no se exponen aquí.
  const intentos = await conexion.query(
    `SELECT jugador_id, intento, picas, fijas, creado_en
     FROM intentos
     WHERE partida_id = $1 AND jugador_id = $2
     ORDER BY id ASC`,
    [partidaId, usuarioId]
  );

  let terminoPorAbandono = null;
  if (partida.estado === 'TERMINADO' && partida.ganador_id) {
    const acierto = await conexion.query(
      'SELECT 1 FROM intentos WHERE partida_id = $1 AND jugador_id = $2 AND fijas = 4 LIMIT 1',
      [partidaId, partida.ganador_id]
    );
    terminoPorAbandono = acierto.rows.length === 0;
  }

  return {
    id: partida.id,
    estado: partida.estado,
    creador: personaONulo(partida.creador_id, partida.creador_nombre),
    unido: personaONulo(partida.unido_id, partida.unido_nombre),
    turno_actual: personaONulo(partida.turno_actual_id, partida.turno_actual_nombre),
    ganador: personaONulo(partida.ganador_id, partida.ganador_nombre),
    termino_por_abandono: terminoPorAbandono,
    secretos: partida.estado === 'TERMINADO'
      ? { creador: partida.creador_secreto, unido: partida.unido_secreto }
      : null,
    intentos: intentos.rows,
  };
}

// Lista TODAS las partidas del sistema (el enunciado pide poder ver los
// juegos por iniciar, en juego y terminados, y quién los inició). Filtro
// opcional por estado.
async function listarPartidas(estado) {
  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    throw errorHttp(400, `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
  }

  const { rows } = await conexion.query(
    `SELECT p.id, p.estado,
            p.creador_id, uc.nombre AS creador_nombre,
            p.unido_id, uu.nombre AS unido_nombre,
            p.ganador_id, ug.nombre AS ganador_nombre
     FROM partidas p
     JOIN usuarios uc ON uc.id = p.creador_id
     LEFT JOIN usuarios uu ON uu.id = p.unido_id
     LEFT JOIN usuarios ug ON ug.id = p.ganador_id
     WHERE ($1::text IS NULL OR p.estado = $1)
     ORDER BY p.id DESC`,
    [estado || null]
  );

  return rows.map((partida) => ({
    id: partida.id,
    estado: partida.estado,
    creador: personaONulo(partida.creador_id, partida.creador_nombre),
    unido: personaONulo(partida.unido_id, partida.unido_nombre),
    ganador: personaONulo(partida.ganador_id, partida.ganador_nombre),
  }));
}

async function abandonarPartida(partidaId, jugadorId) {
  return conTransaccion(async (cliente) => {
    const partida = await bloquearPartida(cliente, partidaId);
    if (partida.estado !== 'EN_JUEGO') {
      throw errorHttp(409, 'La partida no está en juego');
    }
    if (partida.creador_id !== jugadorId && partida.unido_id !== jugadorId) {
      throw errorHttp(403, 'No formas parte de esta partida');
    }

    const ganadorId = jugadorId === partida.creador_id ? partida.unido_id : partida.creador_id;

    await cliente.query(
      `UPDATE partidas SET estado = 'TERMINADO', ganador_id = $1, actualizado_en = now()
       WHERE id = $2`,
      [ganadorId, partidaId]
    );
  });
}

module.exports = {
  crearPartida,
  unirsePartida,
  jugarTurno,
  obtenerPartida,
  listarPartidas,
  abandonarPartida,
};
