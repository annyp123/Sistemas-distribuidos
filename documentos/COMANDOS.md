# Comandos rápidos — Picas y Fijas

Hoja de referencia para no tener que buscar los comandos cada vez. El detalle de cada cosa está en el [README.md](README.md); esto es solo el "copiar y pegar" + los problemas típicos que nos salieron probando esto.

## 0. Si `docker compose version` no funciona

Instala el plugin manualmente (no depende de que el repo de Docker esté en `apt`):

```bash
mkdir -p ~/.docker/cli-plugins
```

```bash
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
```

```bash
chmod +x ~/.docker/cli-plugins/docker-compose
```

```bash
docker compose version
```

## Recordatorio: iniciar sesión en Docker Hub

En cualquier máquina nueva donde vayas a usar `dhanielt/picas-y-fijas:latest` (ya sea Kubernetes descargándola, o tú con `docker run`), si el repositorio es privado necesitas loguearte primero o te da "pull access denied":

```bash
docker login
```

---

## Opción A — Todo local con Docker Compose

### A1. Levantar la API + Postgres

```bash
docker compose up --build -d
```

El `-d` lo deja en segundo plano; así no te bloquea la terminal y evitas tener dos `up` corriendo a la vez (eso causó un `address already in use` una vez).

### A2. Jugar desde la terminal (un comando por jugador, cada uno en su propia terminal)

```bash
docker compose run --rm cliente
```

Menú: Iniciar sesión → Crear partida / Ver partidas (aquí también te unes a una). En cualquier espera o turno puedes escribir `salir`.

---

## Opción B — Desplegar en Kubernetes (cluster ya existente, ej. Killercoda)

La imagen ya está en Docker Hub (`dhanielt/picas-y-fijas:latest`) y el manifiesto apunta ahí, así que **no hace falta `docker build` ni cargar nada** — Kubernetes la descarga sola.

### B1. Aplicar los manifiestos

```bash
kubectl apply -f k8s/postgres-secret.yaml -f k8s/postgres-init-configmap.yaml -f k8s/postgres-pvc.yaml -f k8s/postgres-deployment.yaml -f k8s/postgres-service.yaml -f k8s/app-deployment.yaml -f k8s/app-service.yaml
```

### B2. Esperar a que todo quede `1/1 Running`

```bash
kubectl get pods
```

Si `postgres` se queda en `Pending`: `kubectl get pvc` y `kubectl describe pod -l app=postgres` para ver por qué (típicamente falta almacenamiento dinámico en el cluster).

Si los pods de `picas-y-fijas` quedan en `ImagePullBackOff`: significa que el manifiesto no está apuntando a la imagen correcta de Docker Hub, o que no la subiste. Revisa [k8s/app-deployment.yaml](../k8s/app-deployment.yaml).

### B3. Exponer el servicio (deja esta terminal corriendo, sin cerrarla)

```bash
kubectl port-forward --address 0.0.0.0 svc/picas-y-fijas 3000:3000
```

El `--address 0.0.0.0` es importante: sin eso, `port-forward` solo escucha en `127.0.0.1` del host, y un contenedor Docker (el cliente) no puede llegar ahí por la IP del puente de Docker.

Si te da `address already in use`, es que ya había otro `port-forward` viejo corriendo (apuntando a un pod que ya no existe, por ejemplo después de un `rollout restart`). Mátalo y vuelve a intentar:

```bash
pkill -f "port-forward"
```

### B4. Confirmar que responde (en otra terminal)

```bash
curl http://localhost:3000/health
```


### B5. Jugar contra el cluster, desde un contenedor Docker

Usa directamente la imagen de Docker Hub — así ni siquiera necesitas el proyecto clonado en esa máquina (si el repositorio es privado, haz antes `docker login`, ver arriba):

```bash
docker run -it --rm --add-host=host.docker.internal:host-gateway -e URL_API=http://host.docker.internal:3000 dhanielt/picas-y-fijas:latest node cliente/iniciar.js
```

`--network host` **no funciona** en entornos como Killercoda (el Docker ahí corre anidado y no comparte de verdad la red del host) — por eso usamos `--add-host` con el gateway en vez de eso.

### B6. Comprobar el punto "distribuido" (varias réplicas comparten el mismo estado)

```bash
kubectl scale deployment picas-y-fijas --replicas=5
kubectl get pods
```

Juega otra partida y confirma que todo se ve consistente sin importar a qué pod le toque atender cada request.

---

## Mirar la base de datos

Con Docker Compose:

```bash
docker compose exec postgres psql -U picasyfijas -d picasyfijas
```

Con Kubernetes:

```bash
kubectl exec -it $(kubectl get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U picasyfijas -d picasyfijas
```

Dentro de `psql`:

```sql
\dt
SELECT * FROM usuarios;
SELECT * FROM partidas;
SELECT * FROM intentos;
```

Salir: `\q`

## Apagar / limpiar

Docker Compose (el `-v` también borra los datos, útil si cambió el esquema):

```bash
docker compose down -v
```

Kubernetes:

```bash
kubectl delete -f k8s/
```

## Forzar a Kubernetes a descargar de nuevo la imagen

Si ya estaba desplegado y subiste una imagen nueva a Docker Hub (pasos en el [README](README.md#si-cambias-el-código)):

```bash
kubectl rollout restart deployment picas-y-fijas
```

## Apuntar el cliente a otra URL

Con Docker Compose:

```bash
URL_API=http://otra-ip:3000 docker compose run --rm -e URL_API cliente
```

Con `docker run` suelto (ej. apuntando a Kubernetes vía `port-forward`):

```bash
docker run -it --rm --add-host=host.docker.internal:host-gateway -e URL_API=http://host.docker.internal:OTRO_PUERTO dhanielt/picas-y-fijas:latest node cliente/iniciar.js
```
