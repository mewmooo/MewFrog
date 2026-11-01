#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include "config.h"
#include "local_storage.h"

class WifiProvisioner {
public:
  WifiProvisioner();

  // Memulai portal SoftAP (192.168.4.1)
  bool start();

  // Menghentikan SoftAP dan mendealokasikan WebServer
  void stop();

  // Update periodik non-blocking
  void update(unsigned long now);

  bool isActive() const { return _active; }
  int getRemainingSeconds(unsigned long now) const;
  const char* getApSSID() const { return WIFI_SETUP_AP_NAME; }
  IPAddress getApIP() const { return _apIP; }

  // Indikator jika user baru saja menyimpan kredensial baru
  bool hasNewCredentials() const { return _hasNewCredentials; }
  void clearNewCredentialsFlag() { _hasNewCredentials = false; }

private:
  bool _active;
  bool _hasNewCredentials;
  unsigned long _startMs;
  WebServer* _server;
  IPAddress _apIP;

  void setupRoutes();
  void handleRoot();
  void handleSave();
  void handleDelete();
  void handleExit();
  String buildHtml(const String& scannedOptions);
};

extern WifiProvisioner wifiProvisioner;

