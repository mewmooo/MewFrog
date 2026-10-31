#pragma once

// ============================================================================
// MewBot — File Konfigurasi Rahasia & Kredensial (Template)
// Salin file ini menjadi "secrets.h" dan isi dengan kredensial Anda yang sebenarnya.
// PERINGATAN: JANGAN PERNAH meng-commit file "secrets.h" asli ke Git repository!
// ============================================================================

// --- Kredensial Jaringan Wi-Fi Rumah ---
#define WIFI_SSID           "NAMA_WIFI_RUMAH_ANDA"
#define WIFI_PASSWORD       "PASSWORD_WIFI_ANDA"

// --- Hosted Vercel API Gateway Endpoint ---
// Gunakan HTTPS URL dari deployment Vercel Dashboard Anda
#define MEWBOT_API_HOST     "mewbot-dashboard.vercel.app"
#define MEWBOT_API_PORT     443

// --- Autentikasi Perangkat (Device Token) ---
// Token ini di-generate pada Dashboard Vercel dan disimpan dalam bentuk SHA-256 hash di Supabase
#define MEWBOT_DEVICE_ID    "00000000-0000-0000-0000-000000000000"
#define MEWBOT_DEVICE_TOKEN "mewbot_device_token_secret_placeholder"

// --- Konfigurasi Polling & Timeout ---
#define POLL_INTERVAL_MS    5000     // 5 detik saat terhubung online
#define HTTP_TIMEOUT_MS     4000     // Batas waktu timeout request TLS (maks 4 detik)

