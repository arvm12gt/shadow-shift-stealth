// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// small autopilot that sneaks toward the nearest intel file and backs off
// when the detection meter climbs, so the frame is what a real game looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_LEVEL_CLEAR } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 2;
const PLAY_SECONDS = 24;

function autopilot(world) {
  const s = world.state;
  const p = s.player;
  let tx = s.exit.x;
  let ty = s.exit.y;
  let best = Infinity;
  for (const item of s.intel) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    if (d < best) {
      best = d;
      tx = item.x;
      ty = item.y;
    }
  }
  if (s.keycard && !s.keycard.taken) {
    const d = Math.hypot(s.keycard.x - p.x, s.keycard.y - p.y);
    if (d < best) {
      tx = s.keycard.x;
      ty = s.keycard.y;
    }
  }
  let dx = tx - p.x;
  let dy = ty - p.y;
  // Back off when the meter climbs: run away from the nearest guard.
  if (s.detection > 45) {
    let gx = 0;
    let gy = 0;
    let gd = Infinity;
    for (const g of s.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < gd) {
        gd = d;
        gx = g.x;
        gy = g.y;
      }
    }
    dx = p.x - gx;
    dy = p.y - gy;
  }
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it plus the extras the screen
 * needs.
 */
export function stageShot(name, world) {
  world.resetRun();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false);
    return { screen: SCREEN_TITLE, extra: null };
  }
  if (name === 'end') {
    const s = world.state;
    s.timeMs = 3 * 60 * 1000 + 42 * 1000;
    s.caught = 1;
    return { screen: SCREEN_WIN, extra: { bestMs: s.timeMs } };
  }
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    const move = autopilot(world);
    const events = world.step(STEP, move, false, true);
    if (events & EVENT_LEVEL_CLEAR) break;
  }
  return { screen: SCREEN_PLAY, extra: null };
}
