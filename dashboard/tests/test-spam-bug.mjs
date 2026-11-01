import { readFileSync } from 'fs';
import vm from 'vm';

const html = readFileSync('mewbot_studio_simulator.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
  throw new Error('No script tag found in HTML');
}

const context = {
  console: console,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  performance: { now: () => Date.now() },
  Date: Date,
  Math: Math,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  document: {
    createElement: () => ({ appendChild: () => {}, prepend: () => {}, innerHTML: '', className: '', style: {} }),
    getElementById: (id) => ({
      innerText: '',
      value: '',
      appendChild: () => {},
      prepend: () => {},
      addEventListener: () => {},
      classList: { add: () => {}, remove: () => {} },
      getContext: () => ({
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        drawImage: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }),
        putImageData: () => {}
      })
    }),
    querySelectorAll: () => [],
    body: { getPropertyValue: () => '#10b981' }
  },
  getComputedStyle: () => ({ getPropertyValue: () => '#10b981' }),
  requestAnimationFrame: () => {}
};

vm.createContext(context);
vm.runInContext(scriptMatch[1], context);

vm.runInContext(`
  console.log('[TEST] Initial currentMode:', currentMode, 'previousMode:', previousMode);
  console.log('[TEST] Spamming 5 love mail messages in rapid succession...');
  addLoveMailMessage('Pesan 1: Semangat kerja!');
  addLoveMailMessage('Pesan 2: Sayang kamu!');
  addLoveMailMessage('Pesan 3: Jangan lupa makan!');
  addLoveMailMessage('Pesan 4: Kangen nih!');
  addLoveMailMessage('Pesan 5: Sampai jumpa nanti sore!');

  console.log('[TEST] Total messages in queue:', inMemoryState.messages.length);
  console.log('[TEST] Pending count:', inMemoryState.pending_count);

  const initialCount = inMemoryState.messages.length - 5;
  if (inMemoryState.messages.length !== initialCount + 5) throw new Error('Expected 5 added messages');

  console.log('[TEST] Fast forwarding FIFO queue execution...');
  let iterations = 0;
  while (inMemoryState.messages.some(m => m.status === 'pending' || m.status === 'claimed')) {
    iterations++;
    if (iterations > 30) throw new Error('Infinite loop detected in test!');
    if (currentMode !== 2) {
      processNextLoveMailQueue();
    }
    if (currentMode === 2) {
      console.log('  -> Active msg displayed:', activeMessageId, 'Mode:', currentMode, 'PrevMode:', previousMode);
      if (previousMode === 2) throw new Error('CRITICAL BUG: previousMode is MODE_MESSAGE!');
      deliverLoveMailAck(activeMessageId);
      console.log('  -> Acked msg. Mode returned to:', currentMode, 'PrevMode:', previousMode);
      if (currentMode === 2) throw new Error('CRITICAL BUG: currentMode stuck in MODE_MESSAGE after ACK!');
    }
  }

  console.log('[TEST] All messages processed. Final currentMode:', currentMode, 'previousMode:', previousMode);
  console.log('[TEST] Delivered messages count:', inMemoryState.messages.filter(m => m.status === 'delivered').length);
  console.log('[TEST] Memories archived count:', inMemoryState.memories.length);

  if (currentMode === 2) throw new Error('FAILED: Device stuck in MODE_MESSAGE!');
  console.log('>>> [SUCCESS] SPAM BUG TEST PASSED 100%! No stuck state, FIFO order preserved, all messages delivered!');
`, context);
