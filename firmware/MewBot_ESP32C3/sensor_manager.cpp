#include "sensor_manager.h"

SensorManager sensorManager;

SensorManager::SensorManager()
  : _adxlReady(false),
    _touchReady(true),
    _lastTouchState(false),
    _touchTriggeredPulse(false),
    _lastTouchMs(0),
    _lastMotionCheckMs(0),
    _lastX(0), _lastY(0), _lastZ(0),
    _detectedGesture(0) {}

bool SensorManager::begin() {
  pinMode(TOUCH_PIN, INPUT);

  // Cek keberadaan ADXL345 di bus I2C
  Wire.beginTransmission(ADXL345_I2C_ADDR);
  if (Wire.endTransmission() == 0) {
    _adxl.powerOn();
    _adxl.setRangeSetting(2); // 2g sensitivity
    _adxlReady = true;
  } else {
    _adxlReady = false;
  }

  return true;
}

void SensorManager::update(unsigned long now) {
  // 1. Baca Sensor Sentuh TTP223 (Non-blocking Debounce 50ms)
  bool raw = digitalRead(TOUCH_PIN);
  bool active = (TOUCH_ACTIVE_HIGH == 1) ? (raw == HIGH) : (raw == LOW);

  if (active != _lastTouchState && (now - _lastTouchMs > 50)) {
    _lastTouchMs = now;
    _lastTouchState = active;
    if (active) {
      _touchTriggeredPulse = true;
    }
  }

  // 2. Baca ADXL345 Tiap 100ms
  if (_adxlReady && (now - _lastMotionCheckMs >= 100)) {
    _lastMotionCheckMs = now;
    int x = 0, y = 0, z = 0;
    _adxl.readAccel(&x, &y, &z);

    int dx = abs(x - _lastX);
    int dy = abs(y - _lastY);
    int dz = abs(z - _lastZ);
    int delta = dx + dy + dz;

    _lastX = x;
    _lastY = y;
    _lastZ = z;

    // Klasifikasi Gesture Gerakan
    if (delta > 320) {
      _detectedGesture = 3; // Hard Shake / Pusing Spiral
    } else if (delta > 140) {
      _detectedGesture = 2; // Moderate Shake / Marah
    } else if (delta > 45) {
      _detectedGesture = 1; // Gentle Jerk / Elus Lembut
    } else {
      _detectedGesture = 0;
    }
  }
}

bool SensorManager::isTouchActive() {
  return _lastTouchState;
}

bool SensorManager::wasTouchTriggered() {
  if (_touchTriggeredPulse) {
    _touchTriggeredPulse = false;
    return true;
  }
  return false;
}

int SensorManager::checkMotionGesture() {
  int g = _detectedGesture;
  _detectedGesture = 0; // Clear once read
  return g;
}

bool SensorManager::isAdxlOk() {
  return _adxlReady;
}

bool SensorManager::isTouchOk() {
  return _touchReady;
}

