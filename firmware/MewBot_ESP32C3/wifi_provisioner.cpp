#include "wifi_provisioner.h"

WifiProvisioner wifiProvisioner;

WifiProvisioner::WifiProvisioner()
  : _active(false),
    _hasNewCredentials(false),
    _startMs(0),
    _server(nullptr),
    _apIP(192, 168, 4, 1) {}

bool WifiProvisioner::start() {
  if (_active) return true;

  _startMs = millis();
  _hasNewCredentials = false;

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(_apIP, _apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(WIFI_SETUP_AP_NAME, "");

  _server = new WebServer(80);
  if (!_server) {
    Serial.println(F("[SOFTAP] Gagal mengalokasikan WebServer!"));
    return false;
  }

  setupRoutes();
  _server->begin();
  _active = true;

  Serial.printf("[SOFTAP] Mode Wi-Fi Setup aktif di 192.168.4.1 (SSID: %s, Timeout: %ds)\n",
    WIFI_SETUP_AP_NAME, WIFI_SETUP_TIMEOUT_S);

  return true;
}

void WifiProvisioner::stop() {
  if (!_active) return;

  if (_server) {
    _server->stop();
    delete _server;
    _server = nullptr;
  }

  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  _active = false;

  Serial.println(F("[SOFTAP] Mode Wi-Fi Setup ditutup. Heap memori dibebaskan kembali."));
}

int WifiProvisioner::getRemainingSeconds(unsigned long now) const {
  if (!_active) return 0;
  unsigned long elapsedMs = now - _startMs;
  unsigned long totalMs = WIFI_SETUP_TIMEOUT_S * 1000UL;
  if (elapsedMs >= totalMs) return 0;
  return (int)((totalMs - elapsedMs) / 1000UL);
}

void WifiProvisioner::update(unsigned long now) {
  if (!_active) return;

  if (_server) {
    _server->handleClient();
  }

  if (getRemainingSeconds(now) <= 0) {
    Serial.println(F("[SOFTAP] Timeout tercapai tanpa input. Menutup setup portal..."));
    stop();
  }
}

void WifiProvisioner::setupRoutes() {
  if (!_server) return;

  _server->on("/", HTTP_GET, [this]() {
    handleRoot();
  });

  _server->on("/save", HTTP_POST, [this]() {
    handleSave();
  });

  _server->on("/exit", HTTP_GET, [this]() {
    handleExit();
  });
}

void WifiProvisioner::handleRoot() {
  // Pindai jaringan sekitar (non-blocking scan count)
  int n = WiFi.scanComplete();
  if (n == -2) {
    WiFi.scanNetworks(true); // Mulai async scan jika belum
    n = 0;
  }

  String options = "";
  if (n > 0) {
    for (int i = 0; i < n; ++i) {
      String ssid = WiFi.SSID(i);
      if (ssid.length() > 0) {
        options += "<option value=\"" + ssid + "\">" + ssid + " (" + String(WiFi.RSSI(i)) + "dBm)</option>";
      }
    }
    WiFi.scanDelete();
  }

  String html = buildHtml(options);
  _server->send(200, "text/html", html);
}

void WifiProvisioner::handleSave() {
  if (!_server) return;

  String ssid = _server->arg("ssid");
  String pass = _server->arg("pass");
  ssid.trim();

  if (ssid.length() == 0) {
    _server->send(400, "text/html", "<html><body><h3>Error</h3><p>SSID tidak boleh kosong!</p><a href='/'>Kembali</a></body></html>");
    return;
  }

  // Simpan ke profil NVS
  localStorage.saveWiFiProfile(ssid.c_str(), pass.c_str());
  _hasNewCredentials = true;

  String resp = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>";
  resp += "body{font-family:sans-serif;background:#0d1117;color:#e6edf3;text-align:center;padding:40px 20px;}";
  resp += ".box{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;max-width:360px;margin:auto;}";
  resp += "h2{color:#2ea043;margin-top:0;}p{color:#8b949e;}";
  resp += "</style></head><body><div class='box'>";
  resp += "<h2>Berhasil Disimpan!</h2>";
  resp += "<p>MewBot sedang menghubungkan ke jaringan <b>" + ssid + "</b>...</p>";
  resp += "<p>Portal ini akan ditutup otomatis. Anda dapat menutup browser ini.</p>";
  resp += "</div></body></html>";

  _server->send(200, "text/html", resp);
  delay(100);

  // Jadwalkan penutupan SoftAP
  stop();
}

void WifiProvisioner::handleExit() {
  if (!_server) return;

  _server->send(200, "text/html", "<html><body><h3>Setup Dibatalkan</h3><p>MewBot kembali ke mode normal...</p></body></html>");
  delay(100);
  stop();
}

String WifiProvisioner::buildHtml(const String& scannedOptions) {
  String h = "<!DOCTYPE html><html><head>";
  h += "<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<title>MewBot Wi-Fi Setup</title>";
  h += "<style>";
  h += "body{font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:24px;}";
  h += ".c{max-width:380px;margin:auto;background:#161b22;border:1px solid #30363d;border-radius:14px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,0.5);}";
  h += ".t{text-align:center;color:#2ea043;font-size:20px;font-weight:700;margin-bottom:6px;}";
  h += ".sub{text-align:center;color:#8b949e;font-size:13px;margin-bottom:20px;}";
  h += "label{display:block;font-size:12px;color:#8b949e;margin-top:14px;margin-bottom:6px;font-weight:600;}";
  h += "input,select{width:100%;box-sizing:border-box;padding:12px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:14px;}";
  h += "input:focus,select:focus{border-color:#2ea043;outline:none;}";
  h += ".btn{width:100%;margin-top:20px;padding:12px;background:#2ea043;border:none;border-radius:8px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}";
  h += ".btn:hover{background:#2c974b;}";
  h += ".ext{display:block;text-align:center;margin-top:14px;color:#8b949e;text-decoration:none;font-size:13px;}";
  h += ".ext:hover{color:#e6edf3;}";
  h += ".prof{margin-top:16px;padding:12px;background:#0d1117;border-radius:8px;font-size:12px;color:#8b949e;}";
  h += "</style></head><body><div class='c'>";
  h += "<div class='t'>MewBot FrogPet</div>";
  h += "<div class='sub'>Konfigurasi Jaringan Wi-Fi Lokal</div>";

  h += "<form action='/save' method='POST'>";
  if (scannedOptions.length() > 0) {
    h += "<label>Pilih Wi-Fi Terdeteksi:</label>";
    h += "<select onchange=\"document.getElementById('ssid').value=this.value;\"><option value=''>-- Pilih SSID Sekitar --</option>" + scannedOptions + "</select>";
  }
  h += "<label>Nama Wi-Fi (SSID):</label>";
  h += "<input id='ssid' name='ssid' type='text' required placeholder='Nama Wi-Fi'>";
  h += "<label>Kata Sandi (Password):</label>";
  h += "<input name='pass' type='password' placeholder='Kosongkan jika open network'>";
  h += "<button class='btn' type='submit'>Simpan & Hubungkan</button>";
  h += "</form>";

  // Tampilkan profil yang tersimpan saat ini
  uint8_t count = localStorage.getWiFiProfileCount();
  if (count > 0) {
    h += "<div class='prof'><b>Profil Tersimpan (" + String(count) + "/" + String(MAX_WIFI_PROFILES) + "):</b><br>";
    for (uint8_t i = 0; i < count; i++) {
      WiFiProfile p;
      if (localStorage.getWiFiProfile(i, p)) {
        h += "- " + String(p.ssid) + (i == localStorage.getActiveWiFiIndex() ? " <i>(Aktif)</i>" : "") + "<br>";
      }
    }
    h += "</div>";
  }

  h += "<a class='ext' href='/exit'>Batal & Keluar</a>";
  h += "</div></body></html>";
  return h;
}

