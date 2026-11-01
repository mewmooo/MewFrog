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
  String otaUrl;
  String otaSha256;
  String otaVersion;
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
  const char* getDateFormatted();
  unsigned long getEpochTime();
  bool isTimeSynced();
  bool isClockRunning();

  // Multi-Network Reconnection Trigger
  void triggerImmediateReconnect();

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

  uint8_t _currentProfileIndex;
  uint8_t _profileAttempts;
  bool _wasConnected;

  unsigned long _lastPollMs;
  unsigned long _lastReconnectAttemptMs;
  unsigned long _backoffIntervalMs;
  uint8_t _reconnectAttempts;

  // Auto-Roam Multi-Network Scanner (Non-blocking & Zero CPU Stutter)
  bool _isRoamScanning;
  unsigned long _lastRoamScanMs;
  unsigned long _disconnectStartMs;
  void startAsyncRoamScan();
  bool checkRoamScanResult(unsigned long now);

  void connectToProfile(uint8_t profileIndex);
  void handleWiFiReconnect(unsigned long now);
};

extern CloudClient cloudClient;

