#include "local_storage.h"

LocalStorage localStorage;

LocalStorage::LocalStorage()
  : _cachedMode(MODE_EYES),
    _cachedAlarmEnabled(false),
    _cachedAlarmHour(7),
    _cachedAlarmMinute(0),
    _cachedRevision(0),
    _cachedEpoch(0),
    _cachedActiveWiFiIndex(0),
    _cachedWiFiCount(0) {}

void LocalStorage::begin() {
  _prefs.begin("mewbot", false);
  _cachedMode = (UIMode)_prefs.getUChar("mode", (uint8_t)MODE_EYES);
  _cachedAlarmEnabled = _prefs.getBool("al_en", false);
  _cachedAlarmHour = _prefs.getInt("al_hr", 7);
  _cachedAlarmMinute = _prefs.getInt("al_mn", 0);
  _cachedRevision = _prefs.getUInt("rev", 0);
  _cachedEpoch = _prefs.getUInt("epoch", 0);
  _cachedActiveWiFiIndex = _prefs.getUChar("w_act", 0);
  _cachedWiFiCount = _prefs.getUChar("w_cnt", 0);

  // Initial seed profil Wi-Fi pertama dari config jika NVS masih kosong
  if (_cachedWiFiCount == 0 && strlen(WIFI_SSID) > 0) {
    saveWiFiProfile(WIFI_SSID, WIFI_PASSWORD);
  }
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

uint32_t LocalStorage::getLastKnownEpoch() {
  return _cachedEpoch;
}

void LocalStorage::saveLastKnownEpoch(uint32_t epoch, bool force) {
  // Hanya simpan jika timestamp masuk akal (> akhir 2023)
  if (epoch < 1700000000) return;

  // Mitigasi NVS Flash Wear: tulis hanya jika dipaksa (force) atau sudah berjarak >= 1 jam (3600s)
  if (force || (_cachedEpoch == 0) || (epoch > _cachedEpoch && (epoch - _cachedEpoch >= 3600))) {
    _cachedEpoch = epoch;
    _prefs.putUInt("epoch", epoch);
  }
}

uint8_t LocalStorage::getWiFiProfileCount() {
  return _cachedWiFiCount;
}

bool LocalStorage::getWiFiProfile(uint8_t index, WiFiProfile& profile) {
  if (index >= _cachedWiFiCount || index >= MAX_WIFI_PROFILES) {
    profile.valid = false;
    return false;
  }

  char keyS[8], keyP[8];
  snprintf(keyS, sizeof(keyS), "w_s%u", index);
  snprintf(keyP, sizeof(keyP), "w_p%u", index);

  String s = _prefs.getString(keyS, "");
  String p = _prefs.getString(keyP, "");

  if (s.length() == 0) {
    profile.valid = false;
    return false;
  }

  strncpy(profile.ssid, s.c_str(), sizeof(profile.ssid) - 1);
  profile.ssid[sizeof(profile.ssid) - 1] = '\0';
  strncpy(profile.password, p.c_str(), sizeof(profile.password) - 1);
  profile.password[sizeof(profile.password) - 1] = '\0';
  profile.valid = true;
  return true;
}

bool LocalStorage::saveWiFiProfile(const char* ssid, const char* password) {
  if (!ssid || strlen(ssid) == 0) return false;

  // 1. Cek apakah SSID sudah terdaftar
  int foundSlot = -1;
  WiFiProfile temp;
  for (uint8_t i = 0; i < _cachedWiFiCount; i++) {
    if (getWiFiProfile(i, temp)) {
      if (strcmp(temp.ssid, ssid) == 0) {
        foundSlot = i;
        break;
      }
    }
  }

  uint8_t targetSlot = 0;
  if (foundSlot >= 0) {
    targetSlot = (uint8_t)foundSlot;
  } else if (_cachedWiFiCount < MAX_WIFI_PROFILES) {
    targetSlot = _cachedWiFiCount;
    _cachedWiFiCount++;
    _prefs.putUChar("w_cnt", _cachedWiFiCount);
  } else {
    // Round-robin FIFO jika batas 4 slot telah tercapai
    targetSlot = (_cachedActiveWiFiIndex + 1) % MAX_WIFI_PROFILES;
  }

  char keyS[8], keyP[8];
  snprintf(keyS, sizeof(keyS), "w_s%u", targetSlot);
  snprintf(keyP, sizeof(keyP), "w_p%u", targetSlot);

  _prefs.putString(keyS, ssid);
  _prefs.putString(keyP, password ? password : "");

  setActiveWiFiIndex(targetSlot);
  return true;
}

uint8_t LocalStorage::getActiveWiFiIndex() {
  return _cachedActiveWiFiIndex;
}

void LocalStorage::setActiveWiFiIndex(uint8_t index) {
  if (index >= MAX_WIFI_PROFILES) index = 0;
  if (_cachedActiveWiFiIndex != index) {
    _cachedActiveWiFiIndex = index;
    _prefs.putUChar("w_act", index);
  }
}

