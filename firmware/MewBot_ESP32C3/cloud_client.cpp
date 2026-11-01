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
    _lastPollMs(0),
    _lastReconnectAttemptMs(0),
    _backoffIntervalMs(5000),
    _reconnectAttempts(0) {}

void CloudClient::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  _lastReconnectAttemptMs = millis();

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

void CloudClient::handleWiFiReconnect(unsigned long now) {
  if (WiFi.status() == WL_CONNECTED) {
    _reconnectAttempts = 0;
    _backoffIntervalMs = 5000;
    return;
  }

  // Non-blocking Exponential Backoff (5s -> 10s -> 20s -> 30s -> 60s)
  if (now - _lastReconnectAttemptMs >= _backoffIntervalMs) {
    _lastReconnectAttemptMs = now;
    WiFi.disconnect();
    WiFi.reconnect();

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

String CloudClient::getDateFormatted() {
  unsigned long epoch = getEpochTime();
  if (epoch < 1700000000) {
    return "OFF 00/00";
  }

  time_t raw = (time_t)epoch;
  struct tm *ti = gmtime(&raw);
  if (!ti) return "OFFLINE";

  char buf[16];
  if (isTimeSynced() && WiFi.status() == WL_CONNECTED) {
    const char *days[] = {"MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"};
    snprintf(buf, sizeof(buf), "%s %02d/%02d", days[ti->tm_wday], ti->tm_mday, ti->tm_mon + 1);
  } else {
    // Indikasi jelas bahwa jam berjalan dengan osilator lokal offline tanpa RTC
    snprintf(buf, sizeof(buf), "OFF %02d/%02d", ti->tm_mday, ti->tm_mon + 1);
  }
  return String(buf);
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

  JsonObject sensorObj = reqDoc["sensor"].to<JsonObject>();
  sensorObj["adxl345"] = adxlOk;
  sensorObj["touch"] = touchOk;

  if (lastMsgAck.length() > 0) {
    reqDoc["last_message_ack"] = lastMsgAck;
  }
  reqDoc["config_revision"] = currentRev;

  String reqBody;
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

