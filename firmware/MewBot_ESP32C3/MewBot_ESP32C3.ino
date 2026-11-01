#include <Arduino.h>
#include <Wire.h>

#include "config.h"
#include "local_storage.h"
#include "sensor_manager.h"
#include "display_manager.h"
#include "pet_animation.h"
#include "cloud_client.h"

// ============================================================================
// MewBot ESP32-C3 — Firmware Modular Utama (Non-blocking & Zero-delay)
// ============================================================================

// --- Status Operasi & Mode Sistem ---
static UIMode currentMode = MODE_EYES;
static UIMode previousMode = MODE_EYES;

// --- State Love Mail (Cloud Message) ---
static String activeMessageBody = "";
static String activeMessageId = "";
static unsigned long messageStartMs = 0;
static String lastMessageAck = "";
static unsigned long lastMessageRenderMs = 0;

// --- State Jam Hybrid & Alarm ---
static int lastSecondRendered = -1;
static bool alarmTriggeredToday = false;
static int lastAlarmMinute = -1;

// --- Timers & Telemetry ---
static unsigned long bootMs = 0;

// ============================================================================
// Penanganan Sentuhan (Touch TTP223)
// ============================================================================
void handleTouchInput(unsigned long now) {
  if (!sensorManager.wasTouchTriggered()) return;

  Serial.println(F("[TOUCH] Sentuhan terdeteksi!"));

  // Kasus 1: Sedang menampilkan Love Mail (15 detik) -> Dismiss awal oleh user
  if (currentMode == MODE_MESSAGE) {
    Serial.println(F("[TOUCH] Love Mail di-dismiss awal oleh sentuhan user."));
    if (activeMessageId.length() > 0) {
      lastMessageAck = activeMessageId;
      cloudClient.sendAck(activeMessageId);
    }
    activeMessageBody = "";
    activeMessageId = "";
    currentMode = previousMode;
    if (currentMode == MODE_CLOCK) {
      lastSecondRendered = -1;
    } else {
      petAnimation.triggerInterrupt(PET_HAPPY);
    }
    return;
  }

  // Kasus 2: Mode Normal -> Toggle antara Karakter Kodok (PET) dan Jam (CLOCK)
  if (currentMode == MODE_CLOCK) {
    currentMode = MODE_EYES;
    localStorage.setSavedMode(currentMode);
    petAnimation.triggerInterrupt(PET_HAPPY);
    Serial.println(F("[MODE] Beralih ke MODE_EYES (Pet Frog)."));
  } else {
    currentMode = MODE_CLOCK;
    localStorage.setSavedMode(currentMode);
    lastSecondRendered = -1;
    Serial.println(F("[MODE] Beralih ke MODE_CLOCK (Jam Modern)."));
  }
}

// ============================================================================
// Penanganan Gerakan & Akselerometer (ADXL345)
// ============================================================================
void handleMotionGestures(unsigned long now) {
  int gesture = sensorManager.checkMotionGesture();
  if (gesture == 0) return;

  // Hanya memicu reaksi gestur saat berada pada mode animasi pet
  if (currentMode != MODE_EYES) return;

  // Jika kodok sedang tidur dan ada gerakan apa pun -> kaget bangun
  if (petAnimation.getCurrentExpression() == PET_SLEEPY) {
    Serial.println(F("[GESTURE] Kodok terbangun dari tidur -> Kaget!"));
    petAnimation.triggerInterrupt(PET_SURPRISED);
    return;
  }

  switch (gesture) {
    case 3: // Hard shake
      Serial.println(F("[GESTURE] Guncangan keras -> Pusing Spiral!"));
      petAnimation.triggerInterrupt(PET_DIZZY);
      break;

    case 2: // Moderate shake
      Serial.println(F("[GESTURE] Guncangan sedang -> Marah!"));
      petAnimation.triggerInterrupt(PET_ANGRY);
      break;

    case 1: // Gentle jerk / elus lembut
      Serial.println(F("[GESTURE] Elusan lembut -> Tertawa Senang!"));
      petAnimation.triggerInterrupt(PET_LAUGHING);
      break;

    default:
      break;
  }
}

// ============================================================================
// Penanganan Alarm Terjadwal
// ============================================================================
void handleAlarmCheck(unsigned long now) {
  if (!localStorage.getAlarmEnabled() || !cloudClient.isConnected()) {
    return;
  }

  int curHour = cloudClient.getHours();
  int curMin  = cloudClient.getMinutes();
  int alHour  = localStorage.getAlarmHour();
  int alMin   = localStorage.getAlarmMinute();

  if (curHour == alHour && curMin == alMin) {
    if (!alarmTriggeredToday) {
      alarmTriggeredToday = true;
      Serial.printf("[ALARM] Alarm berbunyi pada %02d:%02d! Kodok melompat ceria.\n", curHour, curMin);
      if (currentMode == MODE_EYES) {
        petAnimation.triggerInterrupt(PET_HAPPY);
      }
    }
  } else {
    // Reset pemicu ketika menit telah berganti
    alarmTriggeredToday = false;
  }
}

// ============================================================================
// Polling Cloud Gateway (HTTPS non-blocking 5 detik)
// ============================================================================
void handleCloudPolling(unsigned long now) {
  if (!cloudClient.shouldPoll(now)) return;

  unsigned long uptimeSec = (now - bootMs) / 1000;
  int rssi = cloudClient.getRssi();
  uint32_t freeHeap = ESP.getFreeHeap();
  bool adxlOk = sensorManager.isAdxlOk();
  bool touchOk = sensorManager.isTouchOk();
  uint32_t currentRev = localStorage.getConfigRevision();

  CloudPollResult res = cloudClient.executePoll(
    currentMode,
    uptimeSec,
    rssi,
    freeHeap,
    adxlOk,
    touchOk,
    lastMessageAck,
    currentRev
  );

  if (res.success) {
    // Jika ACK sebelumnya berhasil diterima gateway, bersihkan antrean ACK
    if (lastMessageAck.length() > 0) {
      lastMessageAck = "";
    }

    // 1. Tangani perubahan konfigurasi & mode dari Dashboard
    if (res.hasNewState) {
      if (res.desiredMode != currentMode && currentMode != MODE_MESSAGE) {
        currentMode = res.desiredMode;
        localStorage.setSavedMode(currentMode);
        if (currentMode == MODE_CLOCK) lastSecondRendered = -1;
        Serial.printf("[CLOUD] Mode diubah dari remote dashboard: %s\n", (currentMode == MODE_CLOCK) ? "CLOCK" : "PET");
      }
      localStorage.setAlarmConfig(res.alarmEnabled, res.alarmHour, res.alarmMinute);
    }

    // 2. Tangani Surat Masuk Baru (Love Mail)
    if (res.hasNewMessage) {
      Serial.printf("[CLOUD] Surat Love Mail baru diterima! ID: %s, Isi: %s\n",
        res.messageId.c_str(), res.messageBody.c_str());

      if (currentMode != MODE_MESSAGE) {
        previousMode = currentMode;
      }
      currentMode = MODE_MESSAGE;
      activeMessageId = res.messageId;
      activeMessageBody = res.messageBody;
      messageStartMs = now;
      lastMessageRenderMs = 0; // Trigger render instan

      // Efek visual awal surat masuk
      petAnimation.triggerInterrupt(PET_SHY);
    }

    // 3. Tangani Perintah Remote (Restart / Command)
    if (res.hasCommand) {
      Serial.printf("[CLOUD] Perintah remote diterima: %s (ID: %s)\n",
        res.commandType.c_str(), res.commandId.c_str());

      if (res.commandType == "RESTART") {
        Serial.printf("[COMMAND] Mengirim ACK untuk restart ID: %s sebelum reboot...\n", res.commandId.c_str());
        cloudClient.sendCommandAck(res.commandId);
        Serial.println(F("[COMMAND] Melakukan reboot perangkat dalam 500ms..."));
        delay(500);
        ESP.restart();
      }
    }
  }
}

// ============================================================================
// Render Display Berdasarkan Mode Aktif
// ============================================================================
void handleDisplayRendering(unsigned long now) {
  // --- 1. Mode Love Mail (Tampilan 15 Detik dengan Progress Bar) ---
  if (currentMode == MODE_MESSAGE) {
    unsigned long elapsed = now - messageStartMs;

    if (elapsed >= LOVE_MAIL_DURATION_MS) {
      // 15 detik berakhir -> Konfirmasi ACK & kembalikan ke mode sebelumnya
      Serial.printf("[LOVE_MAIL] Durasi 15 detik selesai untuk pesan: %s\n", activeMessageId.c_str());
      if (activeMessageId.length() > 0) {
        lastMessageAck = activeMessageId;
        cloudClient.sendAck(activeMessageId);
      }
      activeMessageBody = "";
      activeMessageId = "";
      currentMode = previousMode;
      if (currentMode == MODE_CLOCK) {
        lastSecondRendered = -1;
      }
    } else {
      // Refresh animasi bilah countdown progress bar tiap 100ms
      if (now - lastMessageRenderMs >= 100) {
        lastMessageRenderMs = now;
        displayManager.drawLoveMail(activeMessageBody, elapsed, LOVE_MAIL_DURATION_MS);
      }
    }
    return;
  }

  // --- 2. Mode Jam Hybrid Modern (WIB) ---
  if (currentMode == MODE_CLOCK) {
    int sec = cloudClient.getSeconds();
    if (sec != lastSecondRendered) {
      lastSecondRendered = sec;
      displayManager.drawClock(
        cloudClient.getHours(),
        cloudClient.getMinutes(),
        sec,
        cloudClient.getDateFormatted().c_str(),
        cloudClient.isConnected()
      );
    }
    return;
  }

  // --- 3. Mode Karakter Kodok Lucu (16 Ekspresi Skenario Alami) ---
  if (currentMode == MODE_EYES) {
    petAnimation.update(now);
    return;
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(150);

  Serial.println(F("\n========================================================"));
  Serial.println(F("     MewBot ESP32-C3 Modular Firmware (Native HTTPS)    "));
  Serial.println(F("========================================================"));

  // 1. I2C Bus Fast Mode (400kHz)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, I2C_CLOCK_SPEED);

  // 2. NVS Local Storage
  localStorage.begin();
  currentMode = localStorage.getSavedMode();
  previousMode = currentMode;
  Serial.printf("[SETUP] Mode awal: %s\n", (currentMode == MODE_CLOCK) ? "CLOCK" : "PET");

  // 3. Layar OLED SH1106
  if (!displayManager.begin()) {
    Serial.println(F("[ERROR] Layar OLED SH1106 tidak terdeteksi!"));
  } else {
    Serial.println(F("[SETUP] OLED SH1106 siap."));
  }

  // 4. Sensor Sentuh & ADXL345
  sensorManager.begin();
  Serial.printf("[SETUP] Touch Sensor TTP223: %s | ADXL345: %s\n",
    sensorManager.isTouchOk() ? "READY" : "FAILED",
    sensorManager.isAdxlOk() ? "DETECTED" : "NOT FOUND");

  // 5. Animasi Karakter Kodok
  petAnimation.begin();
  Serial.println(F("[SETUP] Pet Animation Engine siap (155 frame PROGMEM)."));

  // 6. Cloud Client Wi-Fi & NTP (Non-blocking)
  cloudClient.begin();
  Serial.printf("[SETUP] Menghubungkan ke Wi-Fi '%s' (Non-blocking STA)...\n", WIFI_SSID);

  bootMs = millis();
}

// ============================================================================
// LOOP (Zero-delay, 100% Non-blocking Cooperative Scheduler)
// ============================================================================
void loop() {
  unsigned long now = millis();

  // 1. Background Wi-Fi backoff & NTP synchronization
  cloudClient.update(now);

  // 2. Pembacaan sensor sentuh & gestur gerakan
  sensorManager.update(now);
  handleTouchInput(now);
  handleMotionGestures(now);

  // 3. Pengecekan alarm terjadwal
  handleAlarmCheck(now);

  // 4. Polling komunikasi cloud HTTPS non-blocking (tiap 5 detik)
  handleCloudPolling(now);

  // 5. Render tampilan layar sesuai mode aktif
  handleDisplayRendering(now);

  // Yield kooperatif untuk task FreeRTOS ESP32 & Wi-Fi stack
  yield();
}

