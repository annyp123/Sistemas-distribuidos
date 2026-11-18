# Picas y Fijas — API REST (Sistemas Distribuidos)

API REST+JSON del juego Picas y Fijas (tipo Mastermind). Cada jugador digita su propio número secreto de 4 dígitos distintos; se turnan para adivinar el número del rival y el servidor responde cuántas **picas** (dígito correcto, posición incorrecta) y **fijas** (dígito y posición correctos) tiene cada intento. La partida termina en cuanto alguien adivina las 4 fijas del secreto del rival.

> ¿Solo quieres los comandos para correr todo, sin las explicaciones? Mira [COMANDOS.md](COMANDOS.md).

## Diseño distribuido

La API corre con **múltiples réplicas** (pods) detrás de un mismo Service, todas compartiendo el estado de las partidas en una base **Postgres** común (no hay estado en memoria del proceso). Para evitar condiciones de carrera cuando dos requests de la misma partida llegan a pods distintos casi al mismo tiempo, `unirse` y `jugar` abren una transacción con `SELECT ... FOR UPDATE` sobre la fila de la partida antes de leer/escribir su estado.

## Estructura del proyecto

```
servidor/          API REST (Express + Postgres)
  arranque.js        levanta el servidor
  aplicacion.js      configura Express y monta las rutas
  rutas/             endpoints -> controladores
  controladores/     validan la petición HTTP y responden
  servicios/         reglas del juego y consultas SQL
  intermediarios/    autenticación por token y manejo de errores
  basedatos/         conexión a Postgres y esquema.sql
  utilidades/        errores HTTP y lógica de picas y fijas
cliente/           cliente de consola (la interfaz del juego)
  iniciar.js         menú principal
  clienteApi.js      llamadas HTTP a la API
  consola/           entrada de teclado y dibujo de pantalla
  flujos/            acciones del menú y flujo de una partida
k8s/               manifiestos de Kubernetes
```

## Endpoints

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/login` | Crea una sesión. Body: `{ "usuario": "nombre" }`. Devuelve `token`. | No |
| POST | `/juego` | Crea una partida. Body: `{ "secreto": "1234" }`. | Sí |
| PUT | `/juego/{id}` | Une al jugador actual a la partida. Body: `{ "secreto": "5678" }`. | Sí |
| POST | `/juego/{id}/jugar` | Juega un intento (solo si es tu turno). Body: `{ "intento": "1234" }`. | Sí |
| POST | `/juego/{id}/abandonar` | Te rindes: termina la partida y gana el rival. *(No está en el enunciado original, se agregó para que el cliente pueda salir de una partida en curso.)* | Sí |
| GET | `/juego/{id}` | Estado de la partida (SIN_COMPLETAR / EN_JUEGO / TERMINADO), nombres de ambos jugadores, de quién es el turno, **tus propios** intentos (no los del rival) y (solo si ya TERMINÓ) los números secretos de los dos. | Sí |
| GET | `/juego` | Lista **todas** las partidas del sistema (id, estado, quién la inició, rival y ganador si ya terminó) para poder ver las pendientes y unirse a una. Filtro opcional: `?estado=SIN_COMPLETAR`, `EN_JUEGO` o `TERMINADO`. | Sí |
| GET | `/health` | Health check para Kubernetes. | No |

Cualquier jugador puede ver el estado de cualquier partida, pero solo ve **sus propios** intentos y los secretos solo se revelan cuando la partida terminó.

El nombre del jugador se envía una sola vez en `/login`; después el token lo identifica, así que en `PUT /juego/{id}` solo hace falta mandar el número (el servidor ya sabe quién eres).

Las rutas protegidas requieren el header `Authorization: Bearer <token>` obtenido en `/login`. Si vuelves a hacer login con el mismo nombre de usuario, recuperas el mismo id (y por lo tanto el acceso a tus partidas anteriores) — solo cambia el token.

El secreto/intento siempre debe ser una cadena de **4 dígitos distintos** (ej. `1234`, no `1123`).

## Correr localmente con Docker Compose

```bash
docker compose up --build
```

La API queda en `http://localhost:3000`. El servicio `app` y el cliente comparten la misma imagen, `dhanielt/picas-y-fijas:latest`: con `--build` se construye desde este código y se etiqueta con ese nombre; sin `--build`, si no existe localmente, Compose la descarga de Docker Hub.

## Jugar con el cliente de consola (la interfaz del juego)

En lugar de armar los `curl` a mano, el juego se usa con un cliente interactivo de terminal que hace las llamadas por ti. Con la API ya corriendo (`docker compose up --build` en otra terminal), cada jugador abre su propia partida del cliente con:

```bash
docker compose run --rm cliente
```

Esto no necesita tener Node instalado — usa la misma imagen de la API (`dhanielt/picas-y-fijas:latest`), solo que ejecuta el cliente en vez del servidor. Cada jugador corre este comando en su propia terminal (puede ser en la misma máquina, en dos pestañas, o en dos máquinas distintas apuntando a la misma API). El cliente queda dentro de un contenedor "de un solo uso" (`--rm`): al salir del menú (opción `0`), el contenedor se borra solo.

Si prefieres correrlo sin Docker (necesitas Node instalado):

```bash
npm install
npm run cliente
```

Muestra un menú con 3 acciones: **Iniciar sesión**, **Crear partida** y **Ver partidas**.

- **Crear partida**: pides tu secreto y el cliente se queda esperando automáticamente a que alguien se una (refresca solo cada ~2.5s). En cualquier momento puedes escribir `salir` para dejar de esperar sin perder la partida — queda `SIN_COMPLETAR` y la recuperas después desde "Ver partidas".
- Durante la partida, el cliente siempre muestra el tablero: jugadores, de quién es el turno, y **todos tus intentos** con sus picas/fijas (nunca se borran). No se muestran los intentos del rival — son pistas sobre tu propio número, que tú ya conoces, así que solo le sirven a él en su propia terminal. Cuando es tu turno te pide el intento (o puedes escribir `salir` para rendirte); cuando es el turno del rival, espera automáticamente igual que en la sala de espera, mostrando el mensaje de espera una sola vez.
- Al terminar la partida (por victoria o por abandono) se muestra quién ganó y los números secretos de ambos jugadores, y vuelves al menú principal.
- **Ver partidas**: eliges un filtro (todas, sin completar, en juego, terminadas) y ves la lista (estado, quién la creó, rival, ganador; marca con `[mía]` las tuyas). Luego escribes el id de una partida: si espera rival y no es tuya, te unes con tu secreto; si es tuya, la continúas (útil si cerraste el cliente a la mitad); si es de otros, solo la miras.

Si la API no corre en `http://localhost:3000` (por ejemplo, contra Kubernetes con `kubectl port-forward` en otro puerto), se puede apuntar a otra URL. Con Docker:

```bash
URL_API=http://otra-ip:3000 docker compose run --rm -e URL_API cliente
```

O sin Docker:

```bash
URL_API=http://otra-ip:3000 npm run cliente
```

### Flujo de prueba manual (con curl, por si quieres ver las llamadas HTTP crudas)

```bash
# 1. Login de dos jugadores
A=$(curl -s -X POST localhost:3000/login -H "Content-Type: application/json" -d '{"usuario":"ana"}')
B=$(curl -s -X POST localhost:3000/login -H "Content-Type: application/json" -d '{"usuario":"beto"}')
TOKEN_A=$(echo $A | jq -r .token)
TOKEN_B=$(echo $B | jq -r .token)

# 2. Ana crea la partida con su secreto
JUEGO=$(curl -s -X POST localhost:3000/juego -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d '{"secreto":"1234"}')
ID=$(echo $JUEGO | jq -r .id)

# 3. Beto se une con su secreto
curl -s -X PUT localhost:3000/juego/$ID -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"secreto":"5678"}'

# 4. Ver estado completo (jugadores, turno, historial)
curl -s localhost:3000/juego/$ID -H "Authorization: Bearer $TOKEN_A"

# 5. El jugador en turno llama /jugar (repetir alternando token hasta que alguien gane)
curl -s -X POST localhost:3000/juego/$ID/jugar -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d '{"intento":"5678"}'

# 6. Listar todas las partidas (opcional: ?estado=SIN_COMPLETAR)
curl -s "localhost:3000/juego?estado=SIN_COMPLETAR" -H "Authorization: Bearer $TOKEN_A"

# 7. (opcional) Rendirse / abandonar una partida en curso
curl -s -X POST localhost:3000/juego/$ID/abandonar -H "Authorization: Bearer $TOKEN_A"
```

## Desplegar en Kubernetes

El manifiesto ([k8s/app-deployment.yaml](../k8s/app-deployment.yaml)) ya apunta a la imagen publicada en Docker Hub (`dhanielt/picas-y-fijas:latest`), así que **no hace falta construir ni cargar ninguna imagen localmente** — Kubernetes la descarga sola. Solo se necesita `kubectl` apuntando al cluster.

1. Aplicar los manifiestos:

   ```bash
   kubectl apply -f k8s/postgres-secret.yaml -f k8s/postgres-init-configmap.yaml -f k8s/postgres-pvc.yaml -f k8s/postgres-deployment.yaml -f k8s/postgres-service.yaml -f k8s/app-deployment.yaml -f k8s/app-service.yaml
   ```

2. Esperar a que los pods estén listos y exponer el servicio (usa `--address 0.0.0.0` si vas a conectarte desde un contenedor Docker, no solo desde la terminal del host):

   ```bash
   kubectl get pods
   kubectl port-forward --address 0.0.0.0 svc/picas-y-fijas 3000:3000
   ```

3. Repetir el flujo de prueba manual de arriba, o jugar con el cliente de consola, contra `http://localhost:3000`.

4. Para comprobar que el estado se comparte correctamente entre réplicas, escalar el deployment y repetir las jugadas (deberían verse consistentes sin importar a qué pod llegue cada request):

   ```bash
   kubectl scale deployment picas-y-fijas --replicas=5
   ```

### Si cambias el código

Si modificas `servidor/` o `cliente/`, hay que reconstruir y volver a subir la imagen para que Kubernetes la vea (con `imagePullPolicy: Always`, el siguiente reinicio de los pods ya la descarga de nuevo):

```bash
docker build -t dhanielt/picas-y-fijas:latest .
docker push dhanielt/picas-y-fijas:latest
kubectl rollout restart deployment picas-y-fijas
```
