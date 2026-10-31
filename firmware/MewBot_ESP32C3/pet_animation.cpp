#include "pet_animation.h"
#include "display_manager.h"

PetAnimation petAnimation;

const PetExpression kCtxHuntingSteps[]    = { PET_LOOK_AROUND, PET_TONGUE_CATCH, PET_GENTLE_SMILE };
const PetExpression kCtxSleepWakeSteps[]  = { PET_SLEEPY, PET_STRETCHING, PET_BLINK };
const PetExpression kCtxPlayfulSteps[]    = { PET_BODY_WIGGLE, PET_HAPPY, PET_LAUGHING };
const PetExpression kCtxCuriousShySteps[] = { PET_LOOK_AROUND, PET_SHY, PET_HEAD_SCRATCH };
const PetExpression kCtxEmotionalSteps[]  = { PET_ANGRY, PET_SAD_CRYING, PET_BLINK };

PetAnimation::PetAnimation()
  : _currentExpr(PET_NORMAL),
    _currentFrame(0),
    _completedLoops(0),
    _lastFrameMs(0),
    _exprUntilMs(0),
    _isTemporaryEvent(false),
    _activeContext(CTX_HUNTING),
    _contextStepIndex(-1),
    _inContextSequence(false),
    _queuedExpr(PET_TOTAL),
    _queuedDurationMs(0),
    _hasQueuedExpr(false) {}

void PetAnimation::begin() {
  setExpression(PET_NORMAL, 0, true, false);
}

uint8_t PetAnimation::getFrameCount(PetExpression expr) {
  uint8_t c = pgm_read_byte(&(frogPetFrameCounts[(uint8_t)expr]));
  if (c == 0 || c > 10) c = 10;
  return c;
}

unsigned long PetAnimation::getFrameIntervalMs(PetExpression expr, uint8_t frame) {
  switch (expr) {
    case PET_TONGUE_CATCH:
      if (frame <= 2) return 120; // Incar lalat (fokus)
      if (frame == 3) return 65;  // Lidah melesat kilat (snappy action)
      if (frame == 4) return 260; // Lalat tertangkap (impact hold)
      if (frame <= 6) return 130; // Menarik lidah & menelan
      return 190;                 // Senyum puas jilat bibir
    case PET_SURPRISED:
      if (frame <= 1) return 75;  // Kaget melompat cepat
      if (frame <= 5) return 220; // Tahan pose kaget di atas
      return 130;                 // Turun perlahan
    case PET_HAPPY:
      if (frame <= 1) return 80;  // Tekuk kaki & melompat
      if (frame <= 4) return 160; // Melambai di udara
      if (frame == 5) return 100; // Mendarat
      return 150;                 // Berdiri tegap
    case PET_BLINK:
      return 115;                 // Kedipan kilat alami
    case PET_LAUGHING:      return 190;
    case PET_ANGRY:         return 240;
    case PET_NORMAL:        return 280; // Napas santai berbobot
    case PET_GENTLE_SMILE:  return 330;
    case PET_SHY:           return 300;
    case PET_SAD_CRYING:    return 340;
    case PET_SLEEPY:        return 420;
    case PET_LOOK_AROUND:   return 260;
    case PET_STRETCHING:    return 300;
    case PET_HEAD_SCRATCH:  return 200;
    case PET_BODY_WIGGLE:   return 180;
    case PET_DIZZY:         return 185;
    default:                return 250;
  }
}

void PetAnimation::setExpression(PetExpression expr, unsigned long durationMs, bool restart, bool temporaryEvent) {
  unsigned long now = millis();
  if (restart || _currentExpr != expr) {
    _currentExpr = expr;
    _currentFrame = 0;
    _completedLoops = 0;
    _lastFrameMs = now;

    // Render frame awal
    const unsigned char* bmp = (const unsigned char*)pgm_read_ptr(&(frogPetFrames[(uint8_t)_currentExpr][0]));
    displayManager.drawBitmapFrame(bmp);
  }

  if (temporaryEvent) {
    _inContextSequence = false;
    _contextStepIndex = -1;
    _hasQueuedExpr = false;
  }

  _exprUntilMs = (durationMs > 0) ? (now + durationMs) : 0;
  _isTemporaryEvent = temporaryEvent;
}

void PetAnimation::triggerInterrupt(PetExpression expr) {
  setExpression(expr, 0, true, true);
}

PetContextGroup PetAnimation::pickNextContext() {
  uint8_t r = random(100);
  if (r < 40) return CTX_HUNTING;     // 40% Bobot hunting
  if (r < 55) return CTX_SLEEP_WAKE;  // 15%
  if (r < 70) return CTX_PLAYFUL;     // 15%
  if (r < 85) return CTX_CURIOUS_SHY; // 15%
  return CTX_EMOTIONAL;               // 15%
}

void PetAnimation::advanceContext() {
  if (!_inContextSequence) {
    _activeContext = pickNextContext();
    _contextStepIndex = 0;
    _inContextSequence = true;
  } else {
    _contextStepIndex++;
  }

  const PetExpression* steps = nullptr;
  uint8_t totalSteps = 3;

  switch (_activeContext) {
    case CTX_HUNTING:     steps = kCtxHuntingSteps; break;
    case CTX_SLEEP_WAKE:  steps = kCtxSleepWakeSteps; break;
    case CTX_PLAYFUL:     steps = kCtxPlayfulSteps; break;
    case CTX_CURIOUS_SHY: steps = kCtxCuriousShySteps; break;
    case CTX_EMOTIONAL:   steps = kCtxEmotionalSteps; break;
    default: break;
  }

  if (steps && _contextStepIndex < totalSteps) {
    setExpression(steps[_contextStepIndex], 0, true, false);
  } else {
    // Selesai rangkaian skenario -> istirahat bernapas santai 4-7 detik
    _inContextSequence = false;
    _contextStepIndex = -1;
    unsigned long restMs = 4000 + random(3000);
    setExpression(PET_NORMAL, restMs, true, false);
  }
}

void PetAnimation::update(unsigned long now) {
  // Cek timeout ekspresi berdurasi
  if (_exprUntilMs > 0 && now >= _exprUntilMs) {
    _exprUntilMs = 0;
    if (_isTemporaryEvent) {
      _isTemporaryEvent = false;
      setExpression(PET_NORMAL, 3000 + random(2000), true, false);
    } else {
      advanceContext();
    }
    return;
  }

  uint8_t frameCount = getFrameCount(_currentExpr);
  unsigned long interval = getFrameIntervalMs(_currentExpr, _currentFrame);

  if (now - _lastFrameMs >= interval) {
    _lastFrameMs = now;
    _currentFrame++;

    if (_currentFrame >= frameCount) {
      _currentFrame = 0;
      _completedLoops++;

      // Jika aksi one-shot selesai 1 siklus penuh dan bukan event berdurasi eksplisit
      if (_exprUntilMs == 0) {
        if (_isTemporaryEvent) {
          _isTemporaryEvent = false;
          setExpression(PET_NORMAL, 3000, true, false);
          return;
        } else if (_inContextSequence) {
          advanceContext();
          return;
        } else if (_currentExpr == PET_NORMAL && _completedLoops >= 2) {
          advanceContext();
          return;
        }
      }
    }

    // Render frame aktif ke layar OLED
    const unsigned char* bmp = (const unsigned char*)pgm_read_ptr(&(frogPetFrames[(uint8_t)_currentExpr][_currentFrame]));
    displayManager.drawBitmapFrame(bmp);
  }
}

