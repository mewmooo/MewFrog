#include "local_storage.h"

LocalStorage localStorage;

LocalStorage::LocalStorage()
  : _cachedMode(MODE_EYES),
    _cachedAlarmEnabled(false),
    _cachedAlarmHour(7),
    _cachedAlarmMinute(0),
    _cachedRevision(0) {}

void LocalStorage::begin() {
  _prefs.begin("mewbot", false);
  _cachedMode = (UIMode)_prefs.getUChar("mode", (uint8_t)MODE_EYES);
  _cachedAlarmEnabled = _prefs.getBool("al_en", false);
  _cachedAlarmHour = _prefs.getInt("al_hr", 7);
  _cachedAlarmMinute = _prefs.getInt("al_mn", 0);
  _cachedRevision = _prefs.getUInt("rev", 0);
}

UIMode LocalStorage::getSavedMode() {
  return _cachedMode;
}

void LocalStorage::setSavedMode(UIMode mode) {
  if (_cachedMode != mode) {
    _cachedMode = mode;
    _prefs.putUChar("mode", (uint8_t)mode);
  }
}

bool LocalStorage::getAlarmEnabled() {
  return _cachedAlarmEnabled;
}

int LocalStorage::getAlarmHour() {
  return _cachedAlarmHour;
}

int LocalStorage::getAlarmMinute() {
  return _cachedAlarmMinute;
}

void LocalStorage::setAlarmConfig(bool enabled, int hour, int minute) {
  bool changed = false;
  if (_cachedAlarmEnabled != enabled) {
    _cachedAlarmEnabled = enabled;
    _prefs.putBool("al_en", enabled);
    changed = true;
  }
  if (_cachedAlarmHour != hour) {
    _cachedAlarmHour = hour;
    _prefs.putInt("al_hr", hour);
    changed = true;
  }
  if (_cachedAlarmMinute != minute) {
    _cachedAlarmMinute = minute;
    _prefs.putInt("al_mn", minute);
    changed = true;
  }
}

uint32_t LocalStorage::getConfigRevision() {
  return _cachedRevision;
}

void LocalStorage::setConfigRevision(uint32_t rev) {
  if (_cachedRevision != rev) {
    _cachedRevision = rev;
    _prefs.putUInt("rev", rev);
  }
}

