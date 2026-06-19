# KODE_FINAL: Sistem Monitoring Kebakaran & Asap IoT

Sistem pemantauan cerdas berbasis IoT yang dirancang untuk mendeteksi potensi kebakaran secara real-time. Perangkat menggunakan sensor MQ2 (asap) dan sensor api yang dipadukan dengan ESP32, mengirimkan data ke dasbor berbasis web agar pengguna dapat memantau status keamanan gedung atau area secara langsung dari perangkat mobile maupun desktop.

## Fitur Utama

- 🌡️ **Monitoring Real-Time**: Pemantauan sensor asap, api, dan level air setiap 2 detik.
- 📍 **Peta Lokasi**: Visualisasi posisi perangkat menggunakan Leaflet dan OpenStreetMap.
- 📱 **Dukungan PWA**: Dapat diinstal sebagai aplikasi di smartphone untuk kemudahan akses.
- 📡 **Status Koneksi**: Deteksi otomatis status koneksi perangkat (online/offline).
- 📊 **Riwayat Data**: Penyimpanan data historis untuk analisis keamanan.

## Teknologi

- **Frontend**: HTML5, CSS3, JavaScript, Leaflet.js (PWA ready).
- **Backend**: Node.js, Express.js.
- **IoT**: ESP32, Arduino IDE.
- **Deployment**: Vercel (Frontend), Railway (Backend).

## Struktur Proyek

```text
KODE_FINAL/
├── backend/          # API server berbasis Express.js
│   ├── server.js     # Logika server utama
│   ├── package.json  # Konfigurasi dependensi
│   └── render.yaml   # Konfigurasi deployment
├── frontend/         # Antarmuka dasbor pengguna
│   ├── index.html    # Dasbor utama
│   ├── map.html      # Peta lokasi perangkat
│   ├── manifest.json # Konfigurasi PWA
│   └── sw.js         # Service worker untuk offline
└── KODE_FINAL_CLOUD.ino  # Firmware ESP32
```

## Panduan Instalasi

### 1. Backend
1. Masuk ke direktori `backend`.
2. Jalankan `npm install` untuk menginstal dependensi.
3. Jalankan `node server.js` untuk memulai server lokal.

### 2. Frontend
1. Masuk ke direktori `frontend`.
2. File ini bersifat statis, dapat dibuka langsung atau disajikan melalui server statis.

### 3. ESP32
1. Buka file `KODE_FINAL_CLOUD.ino` di Arduino IDE.
2. Atur kredensial WiFi dan API Key backend.
3. Unggah kode ke perangkat ESP32.

## Dokumentasi API

| Endpoint | Metode | Deskripsi |
| :--- | :--- | :--- |
| `/api/data` | POST | Mengirim data sensor (butuh header `x-api-key`) |
| `/api/data` | GET | Mengambil data sensor terbaru |
| `/api/status` | GET | Mengecek status koneksi ESP |
| `/api/history` | GET | Mengambil 100 data terakhir |
| `/api/health` | GET | Cek kesehatan server |

## Instruksi Deployment

- **Frontend**: Hubungkan repositori ke Vercel untuk deployment otomatis.
- **Backend**: Hubungkan repositori ke Railway atau layanan cloud serupa untuk hosting API.

## Kontributor

- [Nama Anggota 1]
- [Nama Anggota 2]
- [Nama Anggota 3]
