#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

struct WiFiProfile {
  char ssid[33];
  char password[65];
  bool valid;
};

class LocalStorage {
public:
  LocalStorage();
  void begin();

  // Mode Operasi (PET vs CLOCK)
  UIMode getSavedMode();
  void setSavedMode(UIMode mode);

  // Konfigurasi Alarm
  bool getAlarmEnabled();
  int getAlarmHour();
  int getAlarmMinute();
  void setAlarmConfig(bool enabled, int hour, int minute);

  // Versi Revisi Konfigurasi Terakhir
  uint32_t getConfigRevision();
  void setConfigRevision(uint32_t rev);

  // Timestamp Terakhir yang Diketahui (Mitigasi NVS Wear & Offline Fallback)
  uint32_t getLastKnownEpoch();
  void saveLastKnownEpoch(uint32_t epoch, bool force = false);

  // Multi-Network Profile Manager (Hingga 4 Jaringan Wi-Fi)
  uint8_t getWiFiProfileCount();
  bool getWiFiProfile(uint8_t index, WiFiProfile& profile);
  bool saveWiFiProfile(const char* ssid, const char* password);
  uint8_t getActiveWiFiIndex();
  void setActiveWiFiIndex(uint8_t index);

private:
  Preferences _prefs;
  UIMode _cachedMode;
  bool _cachedAlarmEnabled;
  int _cachedAlarmHour;
  int _cachedAlarmMinute;
  uint32_t _cachedRevision;
  uint32_t _cachedEpoch;
  uint8_t _cachedActiveWiFiIndex;
  uint8_t _cachedWiFiCount;
};

extern LocalStorage localStorage;

