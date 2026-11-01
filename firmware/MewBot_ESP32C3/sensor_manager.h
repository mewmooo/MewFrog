#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <SparkFun_ADXL345.h>
#include "config.h"

class SensorManager {
public:
  SensorManager();
  bool begin();

  void update(unsigned long now);

  bool isTouchActive();
  bool wasTouchTriggered(); // Single pulse flag (cleared on read)

  int checkMotionGesture(); // 0: none, 1: elus, 2: shake, 3: hard shake
  bool isAdxlOk();
  bool isTouchOk();

private:
  ADXL345 _adxl;
  bool _adxlReady;
  bool _touchReady;

  bool _lastTouchState;
  bool _touchTriggeredPulse;
  unsigned long _lastTouchMs;
  unsigned long _lastTouchTriggeredMs; // Lockout window pemicu sentuhan fisik

  unsigned long _lastMotionCheckMs;
  unsigned long _lastAdxlProbeMs;     // Interval re-probe auto recovery I2C
  int _lastX, _lastY, _lastZ;
  int _detectedGesture;
};

extern SensorManager sensorManager;

