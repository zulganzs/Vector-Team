# Deployment Architecture

---

## 1. Container Overview

Semua komponen berjalan sebagai Docker containers dalam satu network `blazewatch_net`:

```
                    ┌─────────────────────────────────────────┐
                    │          blazewatch_net (Docker Bridge)  │
                    │                                          │
     :80/:443       │  ┌──────────┐                           │
Internet ──────────►│  │  nginx   │                           │
                    │  └────┬─────┘                           │
                    │       │ proxy /api/*                     │
                    │       ▼                                  │
                    │  ┌─────────┐   SQLite Volume            │
                    │  │   app   │◄──(sqlite_data:/app/data)  │
                    │  │ :3000   │                             │
                    │  └────┬────┘                            │
                    │       │                                  │
              :8080 │  ┌────┴──────┐                          │
     WS ───────────►│  │ socketio  │                          │
                    │  │  :8080   │                           │
                    │  └──────────┘                           │
                    │                                          │
                    │  ┌──────────┐   ┌─────────────────┐    │
                    │  │  worker  │   │ sensor-listener  │    │
                    │  │(BullMQ)  │   │ (MQTT sub)       │    │
                    │  └──────────┘   └────────┬─────────┘   │
                    │                          │MQTT           │
                    │  ┌──────────┐   ┌────────▼──────────┐  │
                    │  │  redis   │   │    mosquitto       │  │
                    │  │ :6379    │   │    :1883/:8883     │  │
                    │  └──────────┘   └───────────────────┘  │
                    │                                          │
                    └─────────────────────────────────────────┘
```

---

## 2. Container Details

| Container | Image | Command | Port | Peran |
|-----------|-------|---------|------|-------|
| `nginx` | nginx:alpine | default | 80, 443 | Reverse proxy, TLS termination |
| `app` | custom (Dockerfile) | `node dist/server.js` | 3000 | REST API + cron jobs |
| `socketio` | custom (Dockerfile) | `node dist/websocket-server.js` | 8080 | WebSocket server |
| `worker` | custom (Dockerfile) | `node dist/queue-worker.js` | — | BullMQ SMS worker |
| `sensor-listener` | custom (Dockerfile) | `node dist/mqtt-subscriber.js` | — | MQTT subscriber |
| `redis` | redis:7-alpine | `redis-server --appendonly yes` | 6379 | Cache + Queue backend |
| `mosquitto` | eclipse-mosquitto:2 | default | 1883, 8883 | MQTT broker |

**Semua container:** `restart: unless-stopped`

---

## 3. Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## 4. Docker Volumes

| Volume | Mounted At | Tujuan |
|--------|-----------|--------|
| `sqlite_data` | `/app/data` di container `app` | Persistensi file SQLite |
| `redis_data` | `/data` di container `redis` | Persistensi Redis (AOF) |
| `mosquitto_data` | `/mosquitto/data` | Persistensi MQTT data |
| `mosquitto_log` | `/mosquitto/log` | MQTT log files |

---

## 5. Nginx Configuration

```nginx
# Proxy REST API
location /api/ {
    proxy_pass http://app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Proxy WebSocket (Socket.IO)
location /socket.io/ {
    proxy_pass http://socketio:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 6. Mosquitto Configuration

```conf
# mosquitto.conf
listener 1883
allow_anonymous false
password_file /mosquitto/config/passwords
```

---

## 7. Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `BlazeWatch` | Application name |
| `APP_ENV` | `production` | Environment |
| `APP_URL` | `https://api.blazewatch.id` | Base URL |
| `PORT` | `3000` | REST API port |
| `DB_CONNECTION` | `sqlite` | Database driver |
| `DB_PATH` | `./data/blazewatch.sqlite` | SQLite file path |
| `REDIS_HOST` | `redis` | Redis hostname (Docker service name) |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | — | Min 64 karakter |
| `JWT_TTL` | `15` | Access token TTL (menit) |
| `JWT_REFRESH_TTL` | `10080` | Refresh token TTL (7 hari dalam menit) |
| `TWILIO_SID` | — | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | — | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | — | Nomor pengirim Twilio |
| `FIREFIGHTER_PHONE_NUMBER` | — | Nomor penerima SMS Damkar |
| `SOCKETIO_CORS_ORIGIN` | `http://localhost:5173` | Allowed WebSocket origin |
| `SOCKETIO_PORT` | `8080` | WebSocket server port |
| `SMOKE_THRESHOLD_WARNING` | `300` | Threshold WARNING |
| `SMOKE_THRESHOLD_DANGER` | `600` | Threshold DANGER |
| `SENSOR_OFFLINE_THRESHOLD_SECONDS` | `60` | Offline detection threshold |
| `SENSOR_API_KEY` | — | IoT API key (plain, akan di-hash saat verifikasi) |
| `MQTT_HOST` | `mosquitto` | MQTT broker hostname |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `MQTT_TOPIC_PREFIX` | `blazewatch/sensors` | MQTT topic prefix |

---

## 8. Tech Stack Summary

| Komponen | Teknologi | Versi |
|----------|-----------|-------|
| Backend Framework | Express.js | 4.x |
| Language | TypeScript | 5.x |
| Database | SQLite + Knex.js | 3.x / 3.x |
| Cache & Queue | Redis + BullMQ | 7 / 5.x |
| WebSocket | Socket.IO | 4.x |
| MQTT Broker | Eclipse Mosquitto | 2.x |
| SMS Gateway | Twilio | API v2010 |
| Containerization | Docker + Docker Compose | — |
| Web Server | Nginx | alpine |
| Validation | Zod | 3.x |
| Auth | bcrypt + jsonwebtoken | 5.x / 9.x |
| Logging | Winston | 3.x |
| Scheduling | node-cron | 3.x |

---

## 9. Deployment Command

```bash
# Build dan jalankan semua containers
docker-compose up --build -d

# Lihat logs
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f sensor-listener

# Stop semua
docker-compose down

# Stop dan hapus volumes (HATI-HATI: data hilang)
docker-compose down -v
```
