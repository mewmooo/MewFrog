#pragma once

#include <Arduino.h>
#include <pgmspace.h>
#include "frog_pet_bitmaps.h"
#include "config.h"

// 16 Ekspresi Monokrom Karakter Frog Pet (155 Frame)
enum PetExpression : uint8_t {
  PET_NORMAL = 0,
  PET_BLINK,
  PET_HAPPY,
  PET_LAUGHING,
  PET_ANGRY,
  PET_SLEEPY,
  PET_SURPRISED,
  PET_SAD_CRYING,
  PET_SHY,
  PET_DIZZY,
  PET_GENTLE_SMILE,
  PET_TONGUE_CATCH,
  PET_LOOK_AROUND,
  PET_STRETCHING,
  PET_HEAD_SCRATCH,
  PET_BODY_WIGGLE,
  PET_TOTAL
};

// 5 Kelompok Konteks Skenario Perilaku Kodok
enum PetContextGroup : uint8_t {
  CTX_HUNTING = 0,    // Lirik Sekitar -> Tangkap Lalat -> Senyum Puas (40%)
  CTX_SLEEP_WAKE,     // Tidur -> Bangun & Stretch -> Kedip (15%)
  CTX_PLAYFUL,        // Goyang Menari -> Melompat -> Ketawa (15%)
  CTX_CURIOUS_SHY,    // Menoleh Penonton -> Malu Tutup Muka -> Garuk Kepala (15%)
  CTX_EMOTIONAL,      // Marah -> Menangis -> Kedip Tenang (15%)
  CTX_TOTAL
};

class PetAnimation {
public:
  PetAnimation();
  void begin();
  void update(unsigned long now);

  // Set ekspresi seketika (opsional durasi dalam ms)
  void setExpression(PetExpression expr, unsigned long durationMs = 0, bool restart = false, bool temporaryEvent = false);

  // Trigger interupsi sensorik
  void triggerInterrupt(PetExpression expr);

  PetExpression getCurrentExpression() const { return _currentExpr; }
  uint8_t getCurrentFrame() const { return _currentFrame; }

private:
  PetExpression _currentExpr;
  uint8_t _currentFrame;
  uint8_t _completedLoops;
  unsigned long _lastFrameMs;
  unsigned long _exprUntilMs;
  bool _isTemporaryEvent;

  // Konteks Skenario Alami
  PetContextGroup _activeContext;
  int8_t _contextStepIndex;
  bool _inContextSequence;

  // Antrean Transisi
  PetExpression _queuedExpr;
  unsigned long _queuedDurationMs;
  bool _hasQueuedExpr;

  uint8_t getFrameCount(PetExpression expr);
  unsigned long getFrameIntervalMs(PetExpression expr, uint8_t frame);
  PetContextGroup pickNextContext();
  void advanceContext();
};

extern PetAnimation petAnimation;

