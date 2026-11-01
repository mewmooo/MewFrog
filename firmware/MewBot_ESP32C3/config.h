#pragma once

#include <Arduino.h>

// ============================================================================
// MewBot ESP32-C3 — Konfigurasi Hardware & Parameter Operasi
// ============================================================================

// --- Kredensial & Secrets ---
#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #include "secrets.example.h"
#endif

// Fallback jika belum didefinisikan di secrets.h
#ifndef WIFI_SSID
  #define WIFI_SSID "MewBot_WiFi"
#endif
#ifndef WIFI_PASSWORD
  #define WIFI_PASSWORD "mewbot123"
#endif
#ifndef MEWBOT_API_HOST
  #define MEWBOT_API_HOST "mewbot-dashboard.vercel.app"
#endif
#ifndef MEWBOT_API_PORT
  #define MEWBOT_API_PORT 443
#endif
#ifndef MEWBOT_DEVICE_ID
  #define MEWBOT_DEVICE_ID "00000000-0000-0000-0000-000000000000"
#endif
#ifndef MEWBOT_DEVICE_TOKEN
  #define MEWBOT_DEVICE_TOKEN "default_token"
#endif
#ifndef POLL_INTERVAL_MS
  #define POLL_INTERVAL_MS 5000
#endif
#ifndef HTTP_TIMEOUT_MS
  #define HTTP_TIMEOUT_MS 4000
#endif

// --- Hardware Pin Layout (ESP32-C3 Super Mini) ---
// I2C Bus: SDA -> GPIO8, SCL -> GPIO9 (default ESP32-C3 hardware I2C)
#define I2C_SDA_PIN         8
#define I2C_SCL_PIN         9
#define I2C_CLOCK_SPEED     400000  // 400kHz Fast Mode

// OLED SH1106 Display
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define OLED_RESET_PIN      -1
#define OLED_I2C_ADDR       0x3C

// Capacitive Touch Sensor TTP223
#define TOUCH_PIN           4
#define TOUCH_ACTIVE_HIGH   1

// ADXL345 Accelerometer
#define ADXL345_I2C_ADDR    0x53

// --- Durasi & Timing Sistem ---
#define LOVE_MAIL_DURATION_MS 15000 // Tampilan Love Mail di OLED selama 15 detik
#define CLOCK_REFRESH_MS      1000  // Refresh jam tiap detik
#define STATUS_PUBLISH_MS     15000 // Heartbeat internal
#define FIRMWARE_VERSION      "1.4.0"

// --- Wi-Fi Provisioning & Multi-Network Parameter ---
#define MAX_WIFI_PROFILES     8     // Mendukung hingga 8 profil Wi-Fi tersimpan (Kos, Kampus, Hotspot, Rumah, dll)
#define WIFI_SETUP_AP_NAME    "MewBot-Setup"
#define WIFI_SETUP_TIMEOUT_S  180   // Auto-exit SoftAP setelah 180 detik
#define WIFI_ROAM_SCAN_INTERVAL_MS 25000 // Jeda background scan saat terputus (hemat CPU & baterai)

// --- Mode Operasi Sistem ---
enum UIMode : uint8_t {
  MODE_EYES = 0,    // Karakter Pet Frog Animasi
  MODE_CLOCK = 1,   // Jam Hybrid Modern WIB
  MODE_MESSAGE = 2, // Tampilan Love Mail 15 Detik
  MODE_SETUP = 3    // Portal Wi-Fi SoftAP Setup (192.168.4.1)
};

// ============================================================================
// Root CA Certificate untuk Validasi TLS Vercel Gateway (ISRG Root X1)
// Masa Berlaku: Hingga 4 Juni 2035 (Aman untuk 9+ tahun ke depan)
// ============================================================================
const char MEWBOT_ROOT_CA[] PROGMEM = R"CERT(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8S5JlCd85Uy6euKHgFQxFweeCuGovDl7bcOdK2Q52Hx6Ok97rNpnF5IIR
644RtqxETIE5GFzuMBs77kZiFbQ57nA1auV1vITvxg159EmlepvYPnTAhnDymj4Y
VHo4tgRrez442CUoEYIZ4ykYsntmdnVauKfHRzyNiUgVDumlP89RqZowYmZ303Re
qvMqwSZAkVU69RF4LMjIb52RrmAy42UpmrQ83ORKA3ZU6YoCo78mtPfvY9bkWDwc
g3kqZAzmcf3nW8UA3SmEyqxJICAuU0088SkP4yAct2vECPULI17ndFBBCLJ/84XG
18SpqmLEexZBU1dNV5ChhkK20TVh8ChxbTvzn4rkdwiHueArKHkVmbipn4njv5YH
08450fAEPNdTP1P7my0wJZ5TXI9ivRC3DogooZJdq9w5WYqzNnTUmWtPtETK/u4w
hm+ObrHnP75BunOK09r0CkovRR5C2ghgNgQK30tUCUTBI752Zn/tl8xGGFs8Ce3S
gHAIBVZia++4XX8kbHN54DqtAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIChDAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgBlfgQmvUS+35zANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyhurdtNxSfC0sMt5PeUM2ULxu82d97TVOHvhKO
2bvG/be8VSJN08Da4q3lRHuaUCFsUCcwlfzCnROBKn92KSrmnzugBgFb3l9xmOTt
UJ9ZWsnqxxhJ+aWFKmYzglJ44cRUCvsFiJ5nHfvQVVcC/qh526CyztxkHq++nWUq
rhUGUsWNV37MtwdGFfDe3WnV581SeaArzk953d09BA/FvU48FNYg1AtWBThXZP7V
43Y5Lk9pw5CX49OwxZtRMA5IKpdwmETKAcP2iAL372SkyoKwRH43AbmCdKUMjtCD
AcWmP1IZ7/GUNCzY44WRCeRUpyAbqcnd9Kt0BMNUEZXltg5NwPUdyGTGhk05WXsj
wbEWewNWirVNuwNRyRngWzvOmzNmxLqYmnpowRUKqvYggmSmPEEpyxmZONn2Ax09
kfMVfZ2XVKKDZLFWXmsxz9JWEuvMX5IyYOTGliJtzxNO4v4lNxR5UL2zWgGe8EQ0
CzBl9Mr4PDUl51rvBeUU5nawNCEabAF3AKSmVVdMK8PeDQAtHgWt7437tsPEPrv7
FNTJOmqd8LNOMYLfg68bUft3jOSjnnetF654JXZKvCe+XVS2LtwNgsZDLk+dPnx5
1ECKITRF4q88BzvP7Z7fbNsvnXWewOiMOS2oGhQU42/+2/uvobjolGRIhdm09wbY
fTLIBNsdfQlnsGZVCW+tzRI=
-----END CERTIFICATE-----
)CERT";
