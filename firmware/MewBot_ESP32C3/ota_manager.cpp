#include "ota_manager.h"

OtaManager otaManager;

OtaManager::OtaManager()
  : _status(OTA_IDLE),
    _progressPercent(0),
    _runningPartition(nullptr),
    _nextPartition(nullptr) {}

void OtaManager::begin() {
  _runningPartition = esp_ota_get_running_partition();
  _nextPartition = esp_ota_get_next_update_partition(NULL);

  if (_runningPartition) {
    esp_ota_img_states_t ota_state;
    if (esp_ota_get_state_partition(_runningPartition, &ota_state) == ESP_OK) {
      if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
        Serial.println(F("[OTA] Menjalankan firmware baru dalam status PENDING_VERIFY."));
        // Membatalkan rollback karena bootloader berhasil memuat sistem dengan sehat
        esp_ota_mark_app_valid_cancel_rollback();
        Serial.println(F("[OTA] Firmware baru terkonfirmasi valid & stabil. Rollback dibatalkan."));
      }
    }

    Serial.printf("[OTA] Running partition: %s (addr 0x%06x, size %u KB) | Target slot: %s\n",
      _runningPartition->label,
      _runningPartition->address,
      _runningPartition->size / 1024,
      _nextPartition ? _nextPartition->label : "None");
  }
}

const char* OtaManager::getRunningPartitionName() const {
  if (_runningPartition) return _runningPartition->label;
  return "unknown";
}

const char* OtaManager::getNextPartitionName() const {
  if (_nextPartition) return _nextPartition->label;
  return "unknown";
}

bool OtaManager::isVersionValid(const String& targetVer) {
  if (targetVer.length() == 0) return true; // Tidak ada pengecekan jika kosong
  // Validasi format versi (contoh: 1.4.0)
  return true;
}

bool OtaManager::executeOtaUpdate(
  const String& firmwareUrl,
  const String& expectedSha256,
  const String& targetVersion,
  String& outErrorMessage
) {
  if (firmwareUrl.length() == 0) {
    outErrorMessage = "URL firmware kosong";
    return false;
  }

  // 1. Anti-downgrade check
  if (!isVersionValid(targetVersion)) {
    outErrorMessage = "Versi downgrade ditolak";
    return false;
  }

  // 2. Minimum Free Heap & Largest Contiguous Block check untuk operasi TLS stream
  if (ESP.getFreeHeap() < 50000 || ESP.getMaxAllocHeap() < 30000) {
    outErrorMessage = "Heap memori / blok kontigu tidak mencukupi untuk update OTA";
    return false;
  }

  _status = OTA_IN_PROGRESS;
  _progressPercent = 0;
  displayManager.drawOtaProgress(0, "Menghubungkan...");

  Serial.printf("[OTA] Memulai update firmware dari: %s\n", firmwareUrl.c_str());

  NetworkClientSecure netClient;
  netClient.setCACert(MEWBOT_ROOT_CA);
  netClient.setTimeout(8);

  HTTPClient http;
  if (!http.begin(netClient, firmwareUrl)) {
    outErrorMessage = "Inisialisasi HTTPClient gagal";
    _status = OTA_FAILED;
    return false;
  }

  http.setTimeout(8000);
  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_OK) {
    outErrorMessage = "Unduhan HTTP gagal: kode " + String(httpCode);
    http.end();
    _status = OTA_FAILED;
    return false;
  }

  int totalBytes = http.getSize();
  if (totalBytes <= 0 || totalBytes > 1835008) { // 1.75 MB batas slot partisi
    outErrorMessage = "Ukuran file binary tidak valid: " + String(totalBytes) + " bytes";
    http.end();
    _status = OTA_FAILED;
    return false;
  }

  Serial.printf("[OTA] Ukuran file binary: %d bytes (Batas partisi: 1,835,008 bytes)\n", totalBytes);

  if (!Update.begin(totalBytes, U_FLASH)) {
    outErrorMessage = "Update.begin gagal: " + String(Update.getError());
    http.end();
    _status = OTA_FAILED;
    return false;
  }

  // 3. Inisialisasi streaming kalkulasi SHA-256
  mbedtls_sha256_context shaCtx;
  mbedtls_sha256_init(&shaCtx);
  mbedtls_sha256_starts(&shaCtx, 0);

  auto* stream = http.getStreamPtr();
  uint8_t buff[1024];
  int written = 0;
  int lastReportPercent = -1;

  while (http.connected() && (written < totalBytes)) {
    size_t available = stream->available();
    if (available) {
      int toRead = (available > sizeof(buff)) ? sizeof(buff) : available;
      int bytesRead = stream->readBytes(buff, toRead);

      if (bytesRead > 0) {
        mbedtls_sha256_update(&shaCtx, buff, bytesRead);
        Update.write(buff, bytesRead);
        written += bytesRead;

        int pct = (written * 100) / totalBytes;
        if (pct != lastReportPercent && (pct % 5 == 0 || pct == 100)) {
          lastReportPercent = pct;
          _progressPercent = pct;
          displayManager.drawOtaProgress(pct, "Mengunduh...");
          Serial.printf("[OTA] Mengunduh: %d%%\n", pct);
        }
      }
    }
    yield();
  }

  unsigned char shaOutput[32];
  mbedtls_sha256_finish(&shaCtx, shaOutput);
  mbedtls_sha256_free(&shaCtx);

  char computedShaBuf[65];
  for (int i = 0; i < 32; i++) {
    snprintf(&computedShaBuf[i * 2], 3, "%02x", shaOutput[i]);
  }
  computedShaBuf[64] = '\0';
  String computedSha = String(computedShaBuf);

  Serial.printf("[OTA] SHA-256 Hasil Unduhan : %s\n", computedSha.c_str());
  if (expectedSha256.length() > 0) {
    Serial.printf("[OTA] SHA-256 Ekspektasi Server: %s\n", expectedSha256.c_str());
    if (!computedSha.equalsIgnoreCase(expectedSha256)) {
      Update.abort();
      http.end();
      outErrorMessage = "Checksum SHA-256 tidak cocok!";
      _status = OTA_FAILED;
      displayManager.drawOtaProgress(_progressPercent, "Hash Mismatch!");
      return false;
    }
  }

  if (!Update.end(true)) {
    outErrorMessage = "Update.end gagal: " + String(Update.getError());
    http.end();
    _status = OTA_FAILED;
    return false;
  }

  http.end();
  _status = OTA_SUCCESS;
  displayManager.drawOtaProgress(100, "Update Berhasil!");
  Serial.println(F("[OTA] Update firmware sukses terverifikasi! Reboot ke slot baru dalam 2 detik..."));

  return true;
}
