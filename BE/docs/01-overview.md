# Project Overview

**Referensi:** BlazeWatch PRD v1.0 (28/05/2026) — Karina Nurbani Fadhilah  
**Tim:** Vector

---

## 1. Tujuan Produk

BlazeWatch adalah **sistem deteksi kebakaran berbasis IoT** yang dirancang untuk:

- Mendeteksi bahaya kebakaran secara otomatis dari data sensor asap dan debit air
- Mengorkestrasi respons lintas aktor (Building Manager ↔ Firefighter ↔ Dashboard)
- Mengirimkan notifikasi darurat SMS ke petugas Damkar secara real-time (< 30 detik)
- Menyediakan dashboard monitoring real-time via WebSocket

Backend BlazeWatch berfungsi sebagai **inti pemroses (processing core)** dari seluruh ekosistem, bukan frontend.

---

## 2. Business Problem

### Masalah yang Diselesaikan

Tanpa sistem seperti BlazeWatch, deteksi kebakaran di gedung-gedung bergantung pada:
- Inspeksi manual yang lambat dan rentan human error
- Alarm lokal yang tidak terhubung ke petugas Damkar secara otomatis
- Tidak ada audit trail untuk investigasi pasca-insiden
- Koordinasi antar aktor (pengelola gedung ↔ pemadam) yang lambat

### Solusi BlazeWatch

| Problem | Solusi |
|---------|--------|
| Deteksi terlambat | Sensor IoT kirim data setiap ~5 detik, diklasifikasi otomatis |
| Notifikasi manual | SMS otomatis ke Damkar dalam < 30 detik saat `DANGER` |
| Tidak ada koordinasi | State machine incident yang melibatkan semua aktor |
| Tidak ada audit | Tabel `audit_logs` merekam semua aksi signifikan |
| Visualisasi status | Dashboard real-time via WebSocket (Socket.IO) |

---

## 3. Target Pengguna

| Aktor | Metode Interaksi | Deskripsi |
|-------|-----------------|-----------|
| **IoT Sensor / Wokwi** | MQTT / HTTP REST | Mengirim data asap dan debit air secara periodik |
| **Building Manager** | REST API (via Frontend) | Login, monitor dashboard, dismiss alert, mulai evakuasi |
| **Firefighter (Damkar)** | REST API (via Frontend) | Login, acknowledge insiden, mark resolved |
| **Dashboard Frontend** | REST API + WebSocket | Mengonsumsi data dan menerima event real-time |
| **Admin** | REST API | Manajemen user, konfigurasi sistem |

### Peran & Otorisasi (RBAC)

| Role | Kode | Hak Akses |
|------|------|-----------|
| **Admin** | `admin` | Akses penuh ke seluruh sistem, manajemen user |
| **Building Manager** | `building_manager` | Monitor dashboard, dismiss alert, mulai evakuasi |
| **Firefighter** | `firefighter` | Acknowledge insiden, mark resolved |

---

## 4. Scope MVP

### Di dalam Scope

- REST API endpoints lengkap (Auth, Sensor, Incident, Dashboard, Audit)
- IoT data ingestion via MQTT dan HTTP POST
- Klasifikasi bahaya (Normal / Warning / Danger)
- Incident lifecycle state machine penuh
- SMS notification via Twilio dengan retry logic
- Real-time WebSocket broadcasting via Socket.IO
- Sensor online/offline monitoring (heartbeat setiap 30 detik)
- Audit trail logging
- Docker Compose deployment

### Di luar Scope

- Implementasi frontend/UI
- Konfigurasi hardware fisik
- Deployment ke infrastruktur production skala penuh
- Multi-building support (MVP: single building)
- UI admin untuk konfigurasi threshold

---

## 5. Kapasitas MVP

| Parameter | Target |
|-----------|--------|
| Sensor simultan | 10–50 sensor |
| User aktif concurrent | 5–20 user |
| Data rate sensor | ~1 reading/sensor/5 detik |
| Dashboard response time | P95 < 300ms |
| Status update delay | < 5 detik end-to-end |
| SMS delivery | < 30 detik dari deteksi |
| Uptime target | 99% selama periode kompetisi |

---

## 6. Skenario Demo End-to-End

Skenario kompetisi yang wajib berjalan tanpa error:

| Step | Aksi | Ekspektasi |
|------|------|-----------|
| 1 | Login sebagai Building Manager | JWT diterima, dashboard tampil normal |
| 2 | Wokwi kirim smoke = 750 | Dashboard tampil DANGER dalam < 5 detik |
| 3 | SMS otomatis | SMS terkirim ke nomor Damkar dalam < 30 detik |
| 4 | Login sebagai Firefighter | Lihat incident detail |
| 5 | Firefighter acknowledge | Status update di dashboard Building Manager secara real-time |
| 6 | Building Manager klik "Mulai Evakuasi" | Status → `EVACUATION_STARTED` |
| 7 | Firefighter klik "Tandai Tertangani" | Status → `RESOLVED` |
| 8 | Building Manager close incident | Status → `CLOSED` |
| 9 | Lihat audit log (Admin) | Semua 10 aksi tercatat |
| 10 | Lihat riwayat insiden | Insiden muncul di list |

---

## 7. Klasifikasi Bahaya

| Level | Range Smoke Value | Warna | Aksi Sistem |
|-------|-------------------|-------|-------------|
| **NORMAL** | < 300 | 🟢 Hijau | Tidak ada aksi khusus |
| **WARNING** | 300 – 600 | 🟡 Kuning | Alert di dashboard |
| **DANGER** | > 600 | 🔴 Merah | Alert + SMS otomatis ke Damkar |

> Threshold dapat dikonfigurasi via environment variable:  
> `SMOKE_THRESHOLD_WARNING=300`, `SMOKE_THRESHOLD_DANGER=600`
