# Setup & Installation Guide

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| npm | 10.x | Package manager |
| Docker | 24.x+ | Containerization |
| Docker Compose | 2.x | Multi-container orchestration |
| Git | — | Version control |

---

## 2. Clone & Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd blazewatch-backend

# Install dependencies
npm install
```

---

## 3. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` dengan nilai yang sesuai:

```env
# Application
APP_NAME=BlazeWatch
APP_ENV=development
APP_URL=http://localhost:3000

# Database
DB_CONNECTION=sqlite
DB_PATH=./data/blazewatch.sqlite

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT — WAJIB ganti dengan nilai yang kuat
JWT_SECRET=your-super-secret-jwt-key-minimum-64-characters-change-this-now
JWT_TTL=15
JWT_REFRESH_TTL=10080

# Twilio — Isi dengan kredensial Twilio Anda
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+15551234567
FIREFIGHTER_PHONE_NUMBER=+6281199999999

# Socket.IO
SOCKETIO_CORS_ORIGIN=http://localhost:5173
SOCKETIO_PORT=8080

# Fire Detection Thresholds
SMOKE_THRESHOLD_WARNING=300
SMOKE_THRESHOLD_DANGER=600
SENSOR_OFFLINE_THRESHOLD_SECONDS=60

# IoT
SENSOR_API_KEY=your-sensor-api-key-here
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=blazewatch/sensors
```

---

## 4. Database Setup

```bash
# Buat direktori data jika belum ada
mkdir -p data

# Jalankan semua migrations (membuat 13 tabel)
npx knex migrate:latest --knexfile knexfile.ts

# Jalankan seeders (roles, users demo, building/zone/sensor)
npx knex seed:run --knexfile knexfile.ts
```

**Data seeder yang dibuat:**
- 3 roles: `admin`, `building_manager`, `firefighter`
- 3 users demo (1 per role)
- 1 building, 2 zones, 3 sensors

---

## 5. Running Services (Development)

### Opsi A: Jalankan semuanya dengan Docker Compose (Recommended)

```bash
# Jalankan Redis, Mosquitto, dan seluruh services
docker-compose up -d redis mosquitto

# Jalankan REST API
npm run dev

# Di terminal terpisah — jalankan WebSocket server
npx ts-node src/websocket-server.ts

# Di terminal terpisah — jalankan BullMQ worker
npx ts-node src/queue-worker.ts

# Di terminal terpisah — jalankan MQTT subscriber
npx ts-node src/mqtt-subscriber.ts
```

### Opsi B: Full Docker Compose

```bash
# Build image
docker-compose build

# Jalankan semua 7 containers
docker-compose up -d

# Cek status
docker-compose ps

# Lihat logs real-time
docker-compose logs -f
```

---

## 6. Development Workflow

### Build TypeScript

```bash
npm run build
# Output: ./dist/
```

### Development Mode (Hot Reload)

```bash
npm run dev
# Uses nodemon + ts-node
# Watches src/**/*.ts
```

### Linting

```bash
npm run lint
# Runs ESLint on src/**/*.ts
```

### Formatting

```bash
npm run format
# Runs Prettier on src/**/*.ts
```

---

## 7. Database Migrations

```bash
# Jalankan migrations terbaru
npx knex migrate:latest --knexfile knexfile.ts

# Rollback migration terakhir
npx knex migrate:rollback --knexfile knexfile.ts

# Lihat status migrations
npx knex migrate:status --knexfile knexfile.ts

# Jalankan seeders
npx knex seed:run --knexfile knexfile.ts
```

---

## 8. Testing

```bash
# Jalankan semua tests (single run)
npm test

# Watch mode
npm run test:watch
```

**Stack Testing:**
- Jest — unit testing
- Supertest — integration/API testing

---

## 9. Production Build & Deployment

```bash
# 1. Build TypeScript
npm run build

# 2. Verifikasi entry points
ls dist/server.js
ls dist/websocket-server.js
ls dist/queue-worker.js
ls dist/mqtt-subscriber.js

# 3. Deploy dengan Docker Compose
docker-compose -f docker-compose.yml up --build -d

# 4. Verifikasi semua containers running
docker-compose ps
```

---

## 10. Verifikasi Deployment

### Test REST API

```bash
# Health check (login)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@blazewatch.id","password":"Admin@123"}'

# Test sensor ingestion
curl -X POST http://localhost:3000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -H "X-Sensor-API-Key: your-sensor-api-key-here" \
  -d '{
    "sensor_id": "sensor-001",
    "zone_id": "<zone-uuid>",
    "smoke_value": 750,
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }'
```

### Test MQTT

```bash
# Publish test message ke MQTT broker
docker exec -it <mosquitto-container> \
  mosquitto_pub -h localhost -p 1883 \
  -t "blazewatch/sensors/sensor-001" \
  -m '{"sensor_id":"sensor-001","zone_id":"<uuid>","smoke_value":750,"timestamp":"2026-06-11T10:30:00Z"}'
```

---

## 11. Useful npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run build` | `tsc` | Compile TypeScript ke `dist/` |
| `npm run dev` | `nodemon --exec ts-node src/server.ts` | Dev mode dengan hot reload |
| `npm start` | `node dist/server.js` | Production mode |
| `npm run lint` | `eslint src --ext .ts` | Lint semua TypeScript |
| `npm run format` | `prettier --write src/**/*.ts` | Format semua TypeScript |
| `npm test` | `jest --runInBand` | Jalankan semua tests |
| `npm run test:watch` | `jest --watch` | Test watch mode |
