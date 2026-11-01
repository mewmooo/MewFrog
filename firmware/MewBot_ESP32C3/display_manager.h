#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include "config.h"

class DisplayManager {
public:
  DisplayManager();
  bool begin();

  void clear();
  void show();

  // Render Frame Bitmap Frog Pet dari PROGMEM
  void drawBitmapFrame(const unsigned char* bitmap);

  // Render Layar Jam Hybrid Modern
  void drawClock(int hour, int minute, int second, const char* dateStr, bool wifiOk);

  // Render Layar Love Mail (Word-Wrap Paging, Frame Retro, & Countdown Progress Bar 15 Detik)
  void drawLoveMail(const String& body, unsigned long elapsedMs, unsigned long durationMs, int forcePage = -1);
  int getLoveMailPageCount(const String& body);

private:
  Adafruit_SH1106G _oled;
  void drawModernSecondArc(int cx, int cy, int r, int sec);
  void drawWifiIcon(int x, int y, bool ok);
};

extern DisplayManager displayManager;

