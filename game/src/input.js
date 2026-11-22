// Keyboard input: WASD / arrows to move, Shift to run, C / Control to sneak,
// P or Escape to pause, Space / Enter to confirm. Touch is not the focus;
// the game is built for a desktop keyboard, as the bounty expects.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let confirmQueued = false;
  let pauseQueued = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      confirmQueued = true;
      event.preventDefault();
    }
    if (event.code === 'KeyP' || event.code === 'Escape') pauseQueued = true;
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    down.delete(event.code);
    pressed.delete(event.code);
  }
  function onBlur() {
    down.clear();
    pressed.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', () => canvas.focus());

  return {
    // A unit-ish move vector from the keys held this frame.
    move() {
      let x = 0;
      let y = 0;
      for (const code of down) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    run: () => down.has('ShiftLeft') || down.has('ShiftRight'),
    sneak: () => down.has('KeyC') || down.has('ControlLeft') || down.has('ControlRight'),
    takeConfirm() {
      const v = confirmQueued;
      confirmQueued = false;
      return v;
    },
    takePause() {
      const v = pauseQueued;
      pauseQueued = false;
      return v;
    },
    // True while the named key is held (used by the shot autopilot's driver).
    held(code) {
      return down.has(code);
    },
  };
}
