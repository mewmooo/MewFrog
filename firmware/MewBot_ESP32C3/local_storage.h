#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

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

private:
  Preferences _prefs;
  UIMode _cachedMode;
  bool _cachedAlarmEnabled;
  int _cachedAlarmHour;
  int _cachedAlarmMinute;
  uint32_t _cachedRevision;
};

extern LocalStorage localStorage;

