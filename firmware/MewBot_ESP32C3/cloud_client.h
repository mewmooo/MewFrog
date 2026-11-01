#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"

struct CloudPollResult {
  bool success;
  bool hasNewMessage;
  String messageId;
  String messageBody;

  bool hasNewState;
  UIMode desiredMode;
  bool alarmEnabled;
  int alarmHour;
  int alarmMinute;

  bool hasCommand;
  String commandType;
  String commandId;
};

class CloudClient {
public:
  CloudClient();
  void begin();
  void update(unsigned long now);

  bool isConnected();
  int getRssi();

  // NTP & Local Fallback Time Helpers (WIB UTC+7)
  int getHours();
  int getMinutes();
  int getSeconds();
  String getDateFormatted();
  unsigned long getEpochTime();
  bool isTimeSynced();
  bool isClockRunning();

  // Jalankan polling terjadwal
  bool shouldPoll(unsigned long now);
  CloudPollResult executePoll(UIMode currentMode, unsigned long uptimeSec, int rssi, uint32_t freeHeap, bool adxlOk, bool touchOk, const String& lastMsgAck, uint32_t currentRev);

  // Acknowledgment langsung jika diperlukan
  bool sendAck(const String& messageId);
  bool sendCommandAck(const String& commandId);

private:
  WiFiUDP _ntpUDP;
  NTPClient _timeClient;

  unsigned long _fallbackBaseEpoch;
  unsigned long _fallbackBaseMillis;
  bool _isNtpSynced;
  unsigned long _lastNvsEpochSaveMs;

  unsigned long _lastPollMs;
  unsigned long _lastReconnectAttemptMs;
  unsigned long _backoffIntervalMs;
  uint8_t _reconnectAttempts;

  void handleWiFiReconnect(unsigned long now);
};

extern CloudClient cloudClient;

