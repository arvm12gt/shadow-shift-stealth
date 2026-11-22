// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, level clear and win.
//
// ?seed=N fixes the run. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_PICKUP, EVENT_SPOTTED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_LEVEL_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
void createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);

// Tiny synthesized blips, no audio assets: pickup, spotted alarm, caught sting.
let audioCtx = null;
function blip(freq, ms, type = 'sine', gain = 0.08) {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch {
    // Audio is decoration; silence never blocks the game.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shadow = { world, getScreen: () => scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world, scene.screen, scene.extra);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let levelMsAtClear = 0;
  window.__shadow = { world, getScreen: () => screen };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.resetRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Stay out of the vision cones.');
  }

  function nextLevel() {
    if (world.state.levelIndex + 1 >= world.levelCount) {
      screen = SCREEN_WIN;
      if (best === 0 || world.state.timeMs < best) {
        best = world.state.timeMs;
        saveBest(best);
      }
      announce('Clean getaway. All three levels cleared.');
      return;
    }
    world.loadLevel(world.state.levelIndex + 1);
    screen = SCREEN_PLAY;
    announce(world.state.level.name);
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (input.takePause()) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE && input.takeConfirm()) startGame();
    else if (screen === SCREEN_LEVEL_CLEAR && input.takeConfirm()) nextLevel();
    else if (screen === SCREEN_WIN && input.takeConfirm()) startGame();

    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const move = input.move();
        const events = world.step(STEP, move, input.run(), input.sneak());
        if (events & EVENT_PICKUP) blip(880, 90);
        if (events & EVENT_SPOTTED) {
          blip(220, 300, 'square', 0.06);
          announce('Spotted! Break line of sight!');
        }
        if (events & EVENT_CAUGHT) {
          blip(110, 400, 'sawtooth', 0.07);
          announce('Caught! Back to the start of this level.');
        }
        if (events & EVENT_LEVEL_CLEAR) {
          levelMsAtClear = world.state.levelTimeMs;
          blip(660, 120);
          setTimeout(() => blip(990, 160), 130);
          if (world.state.levelIndex + 1 >= world.levelCount) {
            screen = SCREEN_WIN;
            if (best === 0 || world.state.timeMs < best) {
              best = world.state.timeMs;
              saveBest(best);
            }
            announce('Clean getaway. All three levels cleared.');
          } else {
            screen = SCREEN_LEVEL_CLEAR;
            announce(`${world.state.level.name} clear.`);
          }
          accumulator = 0;
          break;
        }
      }
    }
    const extra = screen === SCREEN_LEVEL_CLEAR
      ? { levelName: world.state.level.name, levelMs: levelMsAtClear }
      : screen === SCREEN_WIN
        ? { bestMs: best }
        : null;
    renderer.draw(world.state, world, screen, extra);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
