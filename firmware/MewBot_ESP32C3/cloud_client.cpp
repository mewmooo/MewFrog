#include "cloud_client.h"

CloudClient cloudClient;

const unsigned long kBackoffSteps[] = { 5000, 10000, 20000, 30000, 60000 };
const uint8_t kTotalBackoffSteps = sizeof(kBackoffSteps) / sizeof(kBackoffSteps[0]);

CloudClient::CloudClient()
  : _timeClient(_ntpUDP, "pool.ntp.org", 7 * 3600, 60000),
    _lastPollMs(0),
    _lastReconnectAttemptMs(0),
    _backoffIntervalMs(5000),
    _reconnectAttempts(0) {}

void CloudClient::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  _lastReconnectAttemptMs = millis();

  _timeClient.begin();
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

int CloudClient::getHours() {
  return _timeClient.getHours();
}

int CloudClient::getMinutes() {
  return _timeClient.getMinutes();
}

int CloudClient::getSeconds() {
  return _timeClient.getSeconds();
}

unsigned long CloudClient::getEpochTime() {
  return _timeClient.getEpochTime();
}

String CloudClient::getDateFormatted() {
  if (WiFi.status() != WL_CONNECTED) {
    return "OFFLINE";
  }
  time_t raw = _timeClient.getEpochTime();
  struct tm *ti = gmtime(&raw);
  if (!ti) return "";

  const char *days[] = {"MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"};
  char buf[16];
  snprintf(buf, sizeof(buf), "%s %02d/%02d", days[ti->tm_wday], ti->tm_mday, ti->tm_mon + 1);
  return String(buf);
}

bool CloudClient::shouldPoll(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) return false;
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
  netClient.setInsecure(); // Menggunakan enkripsi TLS tanpa verifikasi sertifikat root statis
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
  netClient.setInsecure();
  netClient.setTimeout(3);

  HTTPClient http;
  String url = String("https://") + MEWBOT_API_HOST + "/api/device/v1/messages/" + messageId + "/ack";

  if (!http.begin(netClient, url)) return false;
  http.setTimeout(3000);
  http.addHeader("Authorization", String("Bearer ") + MEWBOT_DEVICE_TOKEN);

  int code = http.POST("{}");
  http.end();
  return (code == 200);
}

