#include "cloud_client.h"
#include "local_storage.h"

CloudClient cloudClient;

const unsigned long kBackoffSteps[] = { 5000, 10000, 20000, 30000, 60000 };
const uint8_t kTotalBackoffSteps = sizeof(kBackoffSteps) / sizeof(kBackoffSteps[0]);

CloudClient::CloudClient()
  : _timeClient(_ntpUDP, "pool.ntp.org", 7 * 3600, 60000),
    _fallbackBaseEpoch(0),
    _fallbackBaseMillis(0),
    _isNtpSynced(false),
    _lastNvsEpochSaveMs(0),
    _currentProfileIndex(0),
    _profileAttempts(0),
    _wasConnected(false),
    _lastPollMs(0),
    _lastReconnectAttemptMs(0),
    _backoffIntervalMs(5000),
    _reconnectAttempts(0),
    _isRoamScanning(false),
    _lastRoamScanMs(0),
    _disconnectStartMs(0),
    _roamScanAttemptCount(0),
    _currentRoamIntervalMs(WIFI_ROAM_SCAN_INTERVAL_MS) {}

void CloudClient::begin() {
  WiFi.mode(WIFI_STA);
  _currentProfileIndex = localStorage.getActiveWiFiIndex();
  connectToProfile(_currentProfileIndex);

  uint8_t count = localStorage.getWiFiProfileCount();
  // Jika tersimpan multi-profil (> 1), mulai async scan sejak boot agar langsung mendeteksi AP yang aktif
  if (count > 1) {
    startAsyncRoamScan();
  }

  _lastReconnectAttemptMs = millis();
  _disconnectStartMs = millis();

  _timeClient.begin();

  // Muat epoch terakhir dari NVS untuk fallback offline clock
  uint32_t savedEpoch = localStorage.getLastKnownEpoch();
  if (savedEpoch > 1700000000) {
    _fallbackBaseEpoch = savedEpoch;
    _fallbackBaseMillis = millis();
    Serial.printf("[TIME] Fallback clock dipulihkan dari NVS: epoch %u\n", savedEpoch);
  } else {
    Serial.println(F("[TIME] Belum ada epoch tersimpan di NVS. Menunggu sinkronisasi NTP pertama..."));
  }
}

void CloudClient::connectToProfile(uint8_t profileIndex) {
  WiFiProfile p;
  if (localStorage.getWiFiProfile(profileIndex, p) && strlen(p.ssid) > 0) {
    _currentProfileIndex = profileIndex;
    WiFi.disconnect();
    WiFi.begin(p.ssid, p.password);
    Serial.printf("[WIFI] Menghubungkan ke profil Wi-Fi slot %d: '%s'...\n", profileIndex, p.ssid);
  } else {
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("[WIFI] Menghubungkan ke default Wi-Fi: '%s'...\n", WIFI_SSID);
  }
}

void CloudClient::startAsyncRoamScan() {
  if (_isRoamScanning) return;
  // Non-blocking background Wi-Fi scan di single-core ESP32-C3
  // async=true, show_hidden=false, passive=false, max_ms_per_chan=120ms
  int res = WiFi.scanNetworks(true, false, false, 120);
  if (res == WIFI_SCAN_RUNNING) {
    _isRoamScanning = true;
    _lastRoamScanMs = millis();
    Serial.println(F("[ROAM] Background Wi-Fi scan dimulai (Non-blocking)..."));
  }
}

bool CloudClient::checkRoamScanResult(unsigned long now) {
  if (!_isRoamScanning) return false;

  int16_t scanCount = WiFi.scanComplete();
  if (scanCount == WIFI_SCAN_RUNNING) {
    return false; // Scan masih berjalan asinkronus di FreeRTOS task
  }

  _isRoamScanning = false;

  if (scanCount <= 0) {
    if (scanCount < 0) {
      Serial.println(F("[ROAM] Background scan gagal atau dibatalkan."));
    } else {
      Serial.println(F("[ROAM] Background scan selesai: 0 AP terdeteksi."));
    }
    WiFi.scanDelete();

    // Naikkan interval jeda secara adaptif saat di perjalanan (30s -> 60s -> 120s max)
    if (_roamScanAttemptCount == 0) {
      _currentRoamIntervalMs = 60000;
      _roamScanAttemptCount = 1;
    } else if (_roamScanAttemptCount == 1) {
      _currentRoamIntervalMs = WIFI_ROAM_SCAN_MAX_INTERVAL_MS;
      _roamScanAttemptCount = 2;
    }
    Serial.printf("[ROAM] Mode tenang perjalanan aktif. Scan berikutnya dalam %lu detik.\n", _currentRoamIntervalMs / 1000);
    return false;
  }

  Serial.printf("[ROAM] Background scan selesai: %d AP terdeteksi. Mencocokkan profil...\n", scanCount);

  int bestProfileIndex = -1;
  int bestRssi = -1000;
  String bestSsid = "";

  for (int i = 0; i < scanCount; i++) {
    String detectedSsid = WiFi.SSID(i);
    int rssi = WiFi.RSSI(i);

    int profIdx = localStorage.findProfileBySSID(detectedSsid.c_str());
    if (profIdx >= 0) {
      // Prioritaskan AP tersimpan dengan sinyal terbaik (RSSI tertinggi)
      if (rssi > bestRssi) {
        bestRssi = rssi;
        bestProfileIndex = profIdx;
        bestSsid = detectedSsid;
      }
    }
  }

  // Wajib hapus memori scan dari heap seketika untuk menjaga stabilitas memori C3 Super Mini
  WiFi.scanDelete();

  if (bestProfileIndex >= 0) {
    Serial.printf("[ROAM] Ditemukan kecocokan: '%s' (Slot %d, RSSI %d dBm). Menghubungkan langsung...\n",
      bestSsid.c_str(), bestProfileIndex, bestRssi);
    connectToProfile(bestProfileIndex);
    _lastReconnectAttemptMs = now;
    _reconnectAttempts = 0;
    _profileAttempts = 0;
    _backoffIntervalMs = 5000;
    _roamScanAttemptCount = 0;
    _currentRoamIntervalMs = WIFI_ROAM_SCAN_INTERVAL_MS;
    return true;
  }

  // Jika ada AP lain di udara tapi tidak ada profil yang cocok:
  // Naikkan interval jeda secara adaptif (30s -> 60s -> 120s max)
  if (_roamScanAttemptCount == 0) {
    _currentRoamIntervalMs = 60000;
    _roamScanAttemptCount = 1;
  } else if (_roamScanAttemptCount == 1) {
    _currentRoamIntervalMs = WIFI_ROAM_SCAN_MAX_INTERVAL_MS;
    _roamScanAttemptCount = 2;
  }
  Serial.printf("[ROAM] Tidak ada profil yang cocok. Mode tenang perjalanan aktif: scan berikutnya dalam %lu detik.\n", _currentRoamIntervalMs / 1000);
  return false;
}

void CloudClient::triggerImmediateReconnect() {
  _currentProfileIndex = localStorage.getActiveWiFiIndex();
  _reconnectAttempts = 0;
  _profileAttempts = 0;
  _backoffIntervalMs = 5000;
  _lastReconnectAttemptMs = millis();
  _disconnectStartMs = millis();
  _isRoamScanning = false;
  _roamScanAttemptCount = 0;
  _currentRoamIntervalMs = WIFI_ROAM_SCAN_INTERVAL_MS;
  connectToProfile(_currentProfileIndex);
}

void CloudClient::triggerImmediateRoamScan() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println(F("[ROAM] Trigger manual/sentuhan diterima! Memulai scan Wi-Fi instan..."));
  _roamScanAttemptCount = 0;
  _currentRoamIntervalMs = WIFI_ROAM_SCAN_INTERVAL_MS;
  _lastRoamScanMs = 0;
  if (!_isRoamScanning) {
    startAsyncRoamScan();
  }
}

void CloudClient::handleWiFiReconnect(unsigned long now) {
  if (WiFi.status() == WL_CONNECTED) {
    if (!_wasConnected) {
      _wasConnected = true;
      _reconnectAttempts = 0;
      _profileAttempts = 0;
      _backoffIntervalMs = 5000;
      _disconnectStartMs = 0;
      _isRoamScanning = false;
      _roamScanAttemptCount = 0;
      _currentRoamIntervalMs = WIFI_ROAM_SCAN_INTERVAL_MS;
      localStorage.setActiveWiFiIndex(_currentProfileIndex);
      Serial.printf("[WIFI] Berhasil terhubung! IP: %s (Slot %d)\n",
        WiFi.localIP().toString().c_str(), _currentProfileIndex);
    }
    return;
  }

  _wasConnected = false;

  // Catat waktu awal putus koneksi
  if (_disconnectStartMs == 0) {
    _disconnectStartMs = now;
  }

  // 1. Cek hasil scan asinkronus jika sedang berjalan
  if (_isRoamScanning) {
    if (checkRoamScanResult(now)) {
      return;
    }
  }

  // 2. Jika terputus > 4 detik dan ada >= 2 profil tersimpan, picu Auto-Roam scan adaptif
  uint8_t count = localStorage.getWiFiProfileCount();
  if (count > 1 && !_isRoamScanning && (now - _disconnectStartMs >= 4000)) {
    if (_lastRoamScanMs == 0 || (now - _lastRoamScanMs >= _currentRoamIntervalMs)) {
      startAsyncRoamScan();
      return;
    }
  }

  // 3. Fallback Exponential Backoff & Cycling (5s -> 10s -> 20s -> 30s -> 60s)
  if (!_isRoamScanning && (now - _lastReconnectAttemptMs >= _backoffIntervalMs)) {
    _lastReconnectAttemptMs = now;
    _profileAttempts++;

    // Jika gagal 2x berturut-turut pada profil ini dan ada profil lain, coba profil berikutnya
    if (_profileAttempts >= 2 && count > 1) {
      _profileAttempts = 0;
      _currentProfileIndex = (_currentProfileIndex + 1) % count;
      connectToProfile(_currentProfileIndex);
    } else {
      WiFi.disconnect();
      WiFi.reconnect();
    }

    if (_reconnectAttempts < kTotalBackoffSteps - 1) {
      _reconnectAttempts++;
    }
    _backoffIntervalMs = kBackoffSteps[_reconnectAttempts];
  }
}

void CloudClient::update(unsigned long now) {
  handleWiFiReconnect(now);

  if (WiFi.status() == WL_CONNECTED) {
    _timeClient.update();
    unsigned long ntpEpoch = _timeClient.getEpochTime();
    if (ntpEpoch > 1700000000) {
      if (!_isNtpSynced) {
        _isNtpSynced = true;
        Serial.printf("[TIME] Sinkronisasi NTP Sukses! Epoch WIB: %lu\n", ntpEpoch);
      }
      _fallbackBaseEpoch = ntpEpoch;
      _fallbackBaseMillis = now;

      // Simpan ke NVS berkala (maksimal 1x per jam) untuk mitigasi flash wear
      if (now - _lastNvsEpochSaveMs >= 3600000UL) {
        _lastNvsEpochSaveMs = now;
        localStorage.saveLastKnownEpoch(ntpEpoch, false);
      }
    }
  }
}

bool CloudClient::isConnected() {
  return (WiFi.status() == WL_CONNECTED);
}

int CloudClient::getRssi() {
  if (WiFi.status() == WL_CONNECTED) {
    return WiFi.RSSI();
  }
  return 0;
}

unsigned long CloudClient::getEpochTime() {
  if (_isNtpSynced && WiFi.status() == WL_CONNECTED) {
    return _timeClient.getEpochTime();
  }
  if (_fallbackBaseEpoch > 0) {
    return _fallbackBaseEpoch + ((millis() - _fallbackBaseMillis) / 1000);
  }
  return _timeClient.getEpochTime();
}

int CloudClient::getHours() {
  unsigned long epoch = getEpochTime();
  return (epoch % 86400L) / 3600;
}

int CloudClient::getMinutes() {
  unsigned long epoch = getEpochTime();
  return (epoch % 3600) / 60;
}

int CloudClient::getSeconds() {
  unsigned long epoch = getEpochTime();
  return epoch % 60;
}

const char* CloudClient::getDateFormatted() {
  unsigned long epoch = getEpochTime();
  if (epoch < 1700000000) {
    return "OFF 00/00";
  }

  time_t raw = (time_t)epoch;
  struct tm *ti = gmtime(&raw);
  if (!ti) return "OFFLINE";

  static char s_dateBuf[16];
  if (isTimeSynced() && WiFi.status() == WL_CONNECTED) {
    static const char *days[] = {"MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"};
    snprintf(s_dateBuf, sizeof(s_dateBuf), "%s %02d/%02d", days[ti->tm_wday], ti->tm_mday, ti->tm_mon + 1);
  } else {
    // Indikasi jelas bahwa jam berjalan dengan osilator lokal offline tanpa RTC
    snprintf(s_dateBuf, sizeof(s_dateBuf), "OFF %02d/%02d", ti->tm_mday, ti->tm_mon + 1);
  }
  return s_dateBuf;
}

bool CloudClient::isTimeSynced() {
  return _isNtpSynced && (_timeClient.getEpochTime() > 1700000000);
}

bool CloudClient::isClockRunning() {
  return isTimeSynced() || (_fallbackBaseEpoch > 0);
}

bool CloudClient::shouldPoll(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED || !isTimeSynced()) return false;
  return (now - _lastPollMs >= POLL_INTERVAL_MS);
}

CloudPollResult CloudClient::executePoll(
  UIMode currentMode,
  unsigned long uptimeSec,
  int rssi,
  uint32_t freeHeap,
  bool adxlOk,
  bool touchOk,
  const String& lastMsgAck,
  uint32_t currentRev
) {
  CloudPollResult res;
  res.success = false;
  res.hasNewMessage = false;
  res.hasNewState = false;
  res.hasCommand = false;

  _lastPollMs = millis();

  if (WiFi.status() != WL_CONNECTED) {
    return res;
  }

  NetworkClientSecure netClient;
  netClient.setCACert(MEWBOT_ROOT_CA); // Validasi TLS sertifikat root CA resmi (ISRG Root X1 Vercel)
  netClient.setTimeout(HTTP_TIMEOUT_MS / 1000);

  HTTPClient http;
  String url = String("https://") + MEWBOT_API_HOST + "/api/device/v1/poll";

  if (!http.begin(netClient, url)) {
    return res;
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Authorization", String("Bearer ") + MEWBOT_DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  // Siapkan Payload Request Ringkas
  JsonDocument reqDoc;
  reqDoc["firmware_version"] = FIRMWARE_VERSION;
  reqDoc["mode"] = (currentMode == MODE_CLOCK) ? "CLOCK" : (currentMode == MODE_MESSAGE ? "MESSAGE" : "PET");
  reqDoc["uptime_seconds"] = uptimeSec;
  reqDoc["wifi_rssi"] = rssi;
  reqDoc["free_heap"] = freeHeap;
  reqDoc["min_free_heap"] = ESP.getMinFreeHeap();
  reqDoc["max_alloc_heap"] = ESP.getMaxAllocHeap();

  JsonObject sensorObj = reqDoc["sensor"].to<JsonObject>();
  sensorObj["adxl345"] = adxlOk;
  sensorObj["touch"] = touchOk;

  if (lastMsgAck.length() > 0) {
    reqDoc["last_message_ack"] = lastMsgAck;
  }
  reqDoc["config_revision"] = currentRev;

  String reqBody;
  reqBody.reserve(256);
  serializeJson(reqDoc, reqBody);

  int httpCode = http.POST(reqBody);

  if (httpCode == 200) {
    String respBody = http.getString();
    JsonDocument respDoc;
    DeserializationError jsonErr = deserializeJson(respDoc, respBody);

    if (!jsonErr) {
      res.success = true;

      // 1. Periksa Desired State Baru (Mode / Alarm)
      if (respDoc["desired_state"].is<JsonObject>()) {
        JsonObject st = respDoc["desired_state"];
        res.hasNewState = true;
        const char* mStr = st["mode"] | "PET";
        res.desiredMode = (strcmp(mStr, "CLOCK") == 0) ? MODE_CLOCK : MODE_EYES;
        res.alarmEnabled = st["alarm_enabled"] | false;
        res.alarmHour = st["alarm_hour"] | 7;
        res.alarmMinute = st["alarm_minute"] | 0;
      }

      // 2. Periksa Surat Love Mail Baru (FIFO)
      if (respDoc["message"].is<JsonObject>()) {
        JsonObject msg = respDoc["message"];
        const char* mId = msg["id"] | "";
        const char* mBody = msg["body"] | "";
        if (strlen(mId) > 0 && strlen(mBody) > 0) {
          res.hasNewMessage = true;
          res.messageId = mId;
          res.messageBody = mBody;
        }
      }

      // 3. Periksa Perintah Remote (Restart / OTA)
      if (respDoc["command"].is<JsonObject>()) {
        JsonObject cmd = respDoc["command"];
        const char* cType = cmd["type"] | "";
        const char* cId = cmd["id"] | "";
        if (strlen(cType) > 0) {
          res.hasCommand = true;
          res.commandType = cType;
          res.commandId = cId;

          if (cmd["payload"].is<JsonObject>()) {
            JsonObject p = cmd["payload"];
            const char* u1 = p["url"] | "";
            const char* u2 = p["firmware_url"] | "";
            res.otaUrl = (strlen(u1) > 0) ? u1 : u2;

            const char* s1 = p["sha256"] | "";
            const char* s2 = p["firmware_sha256"] | "";
            res.otaSha256 = (strlen(s1) > 0) ? s1 : s2;

            const char* v1 = p["version"] | "";
            const char* v2 = p["target_version"] | "";
            res.otaVersion = (strlen(v1) > 0) ? v1 : v2;
          }
        }
      }
    }
  }

  http.end();
  return res;
}

bool CloudClient::sendAck(const String& messageId) {
  if (WiFi.status() != WL_CONNECTED || messageId.length() == 0) return false;

  NetworkClientSecure netClient;
  netClient.setCACert(MEWBOT_ROOT_CA);
  netClient.setTimeout(3);

  HTTPClient http;
  String url = String("https://") + MEWBOT_API_HOST + "/api/device/v1/messages/" + messageId + "/ack";

  if (!http.begin(netClient, url)) return false;
  http.setTimeout(3000);
  http.addHeader("Authorization", String("Bearer ") + MEWBOT_DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST("{}");
  http.end();
  return (code == 200);
}

bool CloudClient::sendCommandAck(const String& commandId) {
  if (WiFi.status() != WL_CONNECTED || commandId.length() == 0) return false;

  NetworkClientSecure netClient;
  netClient.setCACert(MEWBOT_ROOT_CA);
  netClient.setTimeout(2);

  HTTPClient http;
  String url = String("https://") + MEWBOT_API_HOST + "/api/device/v1/commands/" + commandId + "/ack";

  if (!http.begin(netClient, url)) return false;
  http.setTimeout(2000);
  http.addHeader("Authorization", String("Bearer ") + MEWBOT_DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST("{}");
  http.end();
  return (code == 200);
}

