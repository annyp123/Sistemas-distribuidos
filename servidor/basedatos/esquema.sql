CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    token UUID NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partidas (
    id SERIAL PRIMARY KEY,
    estado TEXT NOT NULL DEFAULT 'SIN_COMPLETAR',
    creador_id INTEGER NOT NULL REFERENCES usuarios(id),
    creador_secreto TEXT NOT NULL,
    unido_id INTEGER REFERENCES usuarios(id),
    unido_secreto TEXT,
    turno_actual_id INTEGER REFERENCES usuarios(id),
    ganador_id INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intentos (
    id SERIAL PRIMARY KEY,
    partida_id INTEGER NOT NULL REFERENCES partidas(id),
    jugador_id INTEGER NOT NULL REFERENCES usuarios(id),
    intento TEXT NOT NULL,
    picas INTEGER NOT NULL,
    fijas INTEGER NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
