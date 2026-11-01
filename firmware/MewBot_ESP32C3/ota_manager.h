#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <Update.h>
#include <esp_ota_ops.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <mbedtls/sha256.h>
#include "config.h"
#include "display_manager.h"

enum OtaStatus : uint8_t {
  OTA_IDLE = 0,
  OTA_IN_PROGRESS,
  OTA_SUCCESS,
  OTA_FAILED
};

class OtaManager {
public:
  OtaManager();

  // Inisialisasi & verifikasi bootloader saat startup (auto rollback cancel jika sistem sehat)
  void begin();

  // Eksekusi update OTA dengan validasi TLS X.509, streaming SHA-256, dan anti-downgrade
  bool executeOtaUpdate(
    const String& firmwareUrl,
    const String& expectedSha256,
    const String& targetVersion,
    String& outErrorMessage
  );

  OtaStatus getStatus() const { return _status; }
  int getProgressPercent() const { return _progressPercent; }
  const char* getRunningPartitionName() const;
  const char* getNextPartitionName() const;

private:
  OtaStatus _status;
  int _progressPercent;
  const esp_partition_t* _runningPartition;
  const esp_partition_t* _nextPartition;

  bool isVersionValid(const String& targetVer);
};

extern OtaManager otaManager;
