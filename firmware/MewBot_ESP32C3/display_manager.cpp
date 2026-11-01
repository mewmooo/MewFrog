#include "display_manager.h"

DisplayManager displayManager;

DisplayManager::DisplayManager()
  : _oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN) {}

bool DisplayManager::begin() {
  if (!_oled.begin(OLED_I2C_ADDR, true)) {
    return false;
  }
  _oled.clearDisplay();
  _oled.display();
  return true;
}

void DisplayManager::clear() {
  _oled.clearDisplay();
}

void DisplayManager::show() {
  _oled.display();
}

void DisplayManager::drawBitmapFrame(const unsigned char* bitmap) {
  if (!bitmap) return;
  _oled.clearDisplay();
  _oled.drawBitmap(0, 0, bitmap, SCREEN_WIDTH, SCREEN_HEIGHT, SH110X_WHITE);
  _oled.display();
}

void DisplayManager::drawWifiIcon(int x, int y, bool ok) {
  if (ok) {
    _oled.drawPixel(x, y + 6, SH110X_WHITE);
    _oled.drawLine(x - 2, y + 4, x + 2, y + 4, SH110X_WHITE);
    _oled.drawLine(x - 4, y + 2, x + 4, y + 2, SH110X_WHITE);
    _oled.drawLine(x - 6, y, x + 6, y, SH110X_WHITE);
  } else {
    _oled.drawLine(x - 4, y, x + 4, y + 8, SH110X_WHITE);
    _oled.drawLine(x + 4, y, x - 4, y + 8, SH110X_WHITE);
  }
}

void DisplayManager::drawModernSecondArc(int cx, int cy, int r, int sec) {
  _oled.drawCircle(cx, cy, r, SH110X_WHITE);
  int activeDots = (sec * 12) / 59;
  for (int i = 0; i < 12; i++) {
    float a = (-90.0f + i * 30.0f) * (3.14159f / 180.0f);
    int px = cx + (int)(cos(a) * (r - 2));
    int py = cy + (int)(sin(a) * (r - 2));
    if (i <= activeDots) {
      _oled.fillRect(px - 1, py - 1, 2, 2, SH110X_WHITE);
    } else {
      _oled.drawPixel(px, py, SH110X_WHITE);
    }
  }
}

void DisplayManager::drawClock(int hour, int minute, int second, const char* dateStr, bool wifiOk) {
  _oled.clearDisplay();

  // 1. Bingkai luar modern
  _oled.drawRoundRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 8, SH110X_WHITE);

  // 2. Header Bar: [ CLOCK ] di kiri, Wi-Fi icon di kanan
  _oled.drawRoundRect(4, 4, 38, 11, 3, SH110X_WHITE);
  _oled.setTextSize(1);
  _oled.setTextColor(SH110X_WHITE);
  _oled.setCursor(8, 6);
  _oled.print("CLOCK");

  drawWifiIcon(118, 5, wifiOk);

  // 3. Tanggal (WIB)
  if (dateStr && strlen(dateStr) > 0) {
    _oled.setTextSize(1);
    _oled.setCursor(48, 6);
    _oled.print(dateStr);
  }

  // 4. Jam & Menit Besar (Ukuran 2 atau 3)
  char timeBuf[8];
  char colon = (second % 2 == 0) ? ':' : ' ';
  snprintf(timeBuf, sizeof(timeBuf), "%02d%c%02d", hour, colon, minute);

  _oled.setTextSize(3);
  _oled.setCursor(14, 25);
  _oled.print(timeBuf);

  // 5. Lingkaran detik modern di kanan bawah
  drawModernSecondArc(110, 36, 11, second);
  char secBuf[4];
  snprintf(secBuf, sizeof(secBuf), "%02d", second);
  _oled.setTextSize(1);
  _oled.setCursor(104, 33);
  _oled.print(secBuf);

  // 6. Progress bar detik di bagian bawah
  _oled.drawRoundRect(8, 54, 112, 5, 2, SH110X_WHITE);
  int fillW = (second * 108) / 59;
  if (fillW > 0) {
    _oled.fillRoundRect(10, 55, fillW, 3, 1, SH110X_WHITE);
  }

  _oled.display();
}

int DisplayManager::getLoveMailPageCount(const String& body) {
  int linesCount = 0;
  int maxCharsPerLine = 19;
  String s = body;

  while (s.length() > 0 && linesCount < 8) {
    int nextSpace = s.indexOf(' ');
    if (nextSpace == -1) {
      if ((int)s.length() <= maxCharsPerLine) {
        linesCount++;
        s = "";
      } else {
        linesCount++;
        s = s.substring(maxCharsPerLine);
      }
    } else {
      String word = s.substring(0, nextSpace);
      if (word.length() > (size_t)maxCharsPerLine) {
        linesCount++;
        s = s.substring(maxCharsPerLine);
      } else {
        String line = word;
        s = s.substring(nextSpace + 1);
        while (s.length() > 0) {
          int sp2 = s.indexOf(' ');
          String nextWord = (sp2 == -1) ? s : s.substring(0, sp2);
          if (line.length() + 1 + nextWord.length() <= (size_t)maxCharsPerLine) {
            line += " " + nextWord;
            s = (sp2 == -1) ? "" : s.substring(sp2 + 1);
          } else {
            break;
          }
        }
        linesCount++;
      }
    }
  }

  return (linesCount <= 4) ? 1 : 2;
}

void DisplayManager::drawLoveMail(const String& body, unsigned long elapsedMs, unsigned long durationMs, int forcePage) {
  _oled.clearDisplay();

  // 1. Ekstrak baris teks (Word-wrap 19 karakter per baris, maks 8 baris)
  String lines[8];
  int totalLines = 0;
  int maxCharsPerLine = 19;
  String s = body;

  while (s.length() > 0 && totalLines < 8) {
    int nextSpace = s.indexOf(' ');
    if (nextSpace == -1) {
      if ((int)s.length() <= maxCharsPerLine) {
        lines[totalLines++] = s;
        s = "";
      } else {
        lines[totalLines++] = s.substring(0, maxCharsPerLine);
        s = s.substring(maxCharsPerLine);
      }
    } else {
      String word = s.substring(0, nextSpace);
      if (word.length() > (size_t)maxCharsPerLine) {
        lines[totalLines++] = word.substring(0, maxCharsPerLine);
        s = s.substring(maxCharsPerLine);
      } else {
        String line = word;
        s = s.substring(nextSpace + 1);
        while (s.length() > 0) {
          int sp2 = s.indexOf(' ');
          String nextWord = (sp2 == -1) ? s : s.substring(0, sp2);
          if (line.length() + 1 + nextWord.length() <= (size_t)maxCharsPerLine) {
            line += " " + nextWord;
            s = (sp2 == -1) ? "" : s.substring(sp2 + 1);
          } else {
            break;
          }
        }
        lines[totalLines++] = line;
      }
    }
  }

  int totalPages = (totalLines <= 4) ? 1 : 2;
  int activePage = 0;

  if (forcePage >= 0 && forcePage < totalPages) {
    activePage = forcePage;
  } else if (totalPages > 1) {
    // Otomatis ganti halaman di paruh kedua durasi
    activePage = (elapsedMs >= durationMs / 2) ? 1 : 0;
  }

  // 2. Bingkai luar layar OLED
  _oled.drawRoundRect(1, 1, SCREEN_WIDTH - 2, SCREEN_HEIGHT - 2, 4, SH110X_WHITE);

  // 3. Header Banner Sleek [ 💌 LOVE MAIL ]
  _oled.fillRoundRect(4, 3, SCREEN_WIDTH - 8, 12, 2, SH110X_WHITE);
  _oled.setTextSize(1);
  _oled.setTextColor(SH110X_BLACK);

  // Indikator ikon amplop kecil
  _oled.drawRect(8, 5, 8, 6, SH110X_BLACK);
  _oled.drawLine(8, 5, 12, 8, SH110X_BLACK);
  _oled.drawLine(16, 5, 12, 8, SH110X_BLACK);

  _oled.setCursor(20, 5);
  if (totalPages > 1) {
    char headerBuf[24];
    snprintf(headerBuf, sizeof(headerBuf), "LOVE MAIL [%d/%d]", activePage + 1, totalPages);
    _oled.print(headerBuf);
  } else {
    _oled.print("LOVE MAIL (15s)");
  }

  // 4. Panel Chat Bubble Teks
  _oled.setTextColor(SH110X_WHITE);
  _oled.drawRoundRect(4, 16, SCREEN_WIDTH - 8, 38, 3, SH110X_WHITE);

  // 5. Render Baris Teks Sesuai Halaman Aktif
  int startLine = (activePage == 0) ? 0 : 3;
  int linesToShow = (activePage == 0 && totalPages > 1) ? 3 : 4;
  int topY = 19;
  int lineH = 9;

  for (int i = 0; i < linesToShow; i++) {
    int lineIdx = startLine + i;
    if (lineIdx < totalLines) {
      _oled.setCursor(8, topY);
      _oled.print(lines[lineIdx]);
      topY += lineH;
    }
  }

  // 6. Garis Hitung Mundur 15 Detik di Bawah
  _oled.drawRoundRect(6, 56, 116, 4, 1, SH110X_WHITE);
  if (durationMs > 0 && elapsedMs < durationMs) {
    float remainRatio = 1.0f - ((float)elapsedMs / (float)durationMs);
    int barW = (int)(112.0f * remainRatio);
    if (barW > 0) {
      _oled.fillRoundRect(8, 57, barW, 2, 1, SH110X_WHITE);
    }
  }

  _oled.display();
}



void DisplayManager::drawSetupScreen(const char* apName, const char* ipStr, int remainingSec) {
  _oled.clearDisplay();

  // 1. Bingkai luar layar OLED
  _oled.drawRoundRect(1, 1, SCREEN_WIDTH - 2, SCREEN_HEIGHT - 2, 4, SH110X_WHITE);

  // 2. Header Banner Terbalik [ WI-FI SETUP ]
  _oled.fillRoundRect(4, 3, SCREEN_WIDTH - 8, 12, 2, SH110X_WHITE);
  _oled.setTextSize(1);
  _oled.setTextColor(SH110X_BLACK);

  // Simbol Wi-Fi kecil di header
  _oled.drawPixel(10, 10, SH110X_BLACK);
  _oled.drawLine(9, 8, 11, 8, SH110X_BLACK);
  _oled.drawLine(8, 6, 12, 6, SH110X_BLACK);

  _oled.setCursor(18, 5);
  _oled.print("WI-FI SETUP PORTAL");

  // 3. Panel Informasi Koneksi
  _oled.setTextColor(SH110X_WHITE);
  _oled.drawRoundRect(4, 16, SCREEN_WIDTH - 8, 38, 3, SH110X_WHITE);

  _oled.setCursor(8, 19);
  _oled.print("1. Hubungkan Wi-Fi:");
  _oled.setCursor(8, 28);
  _oled.print("   ");
  _oled.print(apName ? apName : "MewBot-Setup");

  _oled.setCursor(8, 37);
  _oled.print("2. Buka ");
  _oled.print(ipStr ? ipStr : "192.168.4.1");

  _oled.setCursor(8, 45);
  char timeBuf[20];
  snprintf(timeBuf, sizeof(timeBuf), "Sisa Waktu: %ds", remainingSec);
  _oled.print(timeBuf);

  // 4. Progress bar sisa waktu di bawah
  _oled.drawRoundRect(6, 56, 116, 4, 1, SH110X_WHITE);
  if (remainingSec > 0) {
    int maxSec = WIFI_SETUP_TIMEOUT_S > 0 ? WIFI_SETUP_TIMEOUT_S : 180;
    float ratio = (float)remainingSec / (float)maxSec;
    if (ratio > 1.0f) ratio = 1.0f;
    int barW = (int)(112.0f * ratio);
    if (barW > 0) {
      _oled.fillRoundRect(8, 57, barW, 2, 1, SH110X_WHITE);
    }
  }

  _oled.display();
}
