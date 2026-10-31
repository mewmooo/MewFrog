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
#define FIRMWARE_VERSION      "1.0.0"

// --- Mode Operasi Sistem ---
enum UIMode : uint8_t {
  MODE_EYES = 0,    // Karakter Pet Frog Animasi
  MODE_CLOCK = 1,   // Jam Hybrid Modern WIB
  MODE_MESSAGE = 2  // Tampilan Love Mail 15 Detik
};

