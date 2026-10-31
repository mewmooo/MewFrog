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

void DisplayManager::drawLoveMail(const String& body, unsigned long elapsedMs, unsigned long durationMs) {
  _oled.clearDisplay();

  // 1. Bingkai luar layar OLED
  _oled.drawRoundRect(2, 2, SCREEN_WIDTH - 4, SCREEN_HEIGHT - 4, 6, SH110X_WHITE);

  // 2. Banner Header [ 💌 LOVE MAIL ]
  _oled.fillRoundRect(5, 5, SCREEN_WIDTH - 10, 13, 3, SH110X_WHITE);
  _oled.setTextSize(1);
  _oled.setTextColor(SH110X_BLACK);
  _oled.setCursor(24, 8);
  _oled.print("LOVE MAIL (15s)");

  // Indikator ikon amplop kecil di banner
  _oled.drawRect(10, 8, 8, 6, SH110X_BLACK);
  _oled.drawLine(10, 8, 14, 11, SH110X_BLACK);
  _oled.drawLine(18, 8, 14, 11, SH110X_BLACK);

  // 3. Panel Balon Pesan (Chat Bubble)
  _oled.setTextColor(SH110X_WHITE);
  _oled.drawRoundRect(5, 20, SCREEN_WIDTH - 10, 32, 4, SH110X_WHITE);

  // 4. Word-Wrap Rendering Teks Pesan (Maks 80 karakter)
  int left = 9;
  int top = 24;
  int lineH = 9;
  int maxCharsPerLine = 18; // 18 karakter * 6px font = 108px max width

  String s = body;
  while (s.length() && top <= 44) {
    String line = "";
    int nextSpace = s.indexOf(' ');

    if (nextSpace == -1) {
      if ((int)s.length() <= maxCharsPerLine) {
        line = s;
        s = "";
      } else {
        line = s.substring(0, maxCharsPerLine);
        s = s.substring(maxCharsPerLine);
      }
    } else {
      String word = s.substring(0, nextSpace);
      if (word.length() > (size_t)maxCharsPerLine) {
        line = word.substring(0, maxCharsPerLine);
        s = s.substring(maxCharsPerLine);
      } else {
        line = word;
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
      }
    }

    _oled.setCursor(left, top);
    _oled.print(line);
    top += lineH;
  }

  // 5. Garis Hitung Mundur 15 Detik di Bawah
  _oled.drawRoundRect(7, 55, 114, 4, 1, SH110X_WHITE);
  if (durationMs > 0 && elapsedMs < durationMs) {
    float remainRatio = 1.0f - ((float)elapsedMs / (float)durationMs);
    int barW = (int)(110.0f * remainRatio);
    if (barW > 0) {
      _oled.fillRoundRect(9, 56, barW, 2, 1, SH110X_WHITE);
    }
  }

  _oled.display();
}

