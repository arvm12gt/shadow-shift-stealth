// Shadow Shift world: one level at a time. The player sneaks through a
// tile map while guards patrol waypoints with vision cones. Detection is a
// meter, not a switch: being seen fills it, breaking line of sight drains
// it, and a full meter means a chase — getting caught sends the player
// back to the level start.
import { COLS, GUARD, LEVELS, PLAYER, ROWS, TILE } from './config.js';

export const EVENT_CAUGHT = 1;
export const EVENT_LEVEL_CLEAR = 2;
export const EVENT_PICKUP = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_HEARD = 16;

export const GUARD_CALM = 0;
export const GUARD_SUSPICIOUS = 1;
export const GUARD_ALERT = 2;

function tileAt(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return level.map[row][col];
}

function isWall(level, col, row) {
  return tileAt(level, col, row) === '#';
}

// Circle-vs-wall-tiles collision, axis separated so the player and the
// guards slide along walls instead of sticking to them.
function moveCircle(level, body, dx, dy) {
  const r = body.radius;
  let x = body.x + dx;
  const top = Math.floor((body.y - r) / TILE);
  const bottom = Math.floor((body.y + r) / TILE);
  const left = Math.floor((x - r) / TILE);
  const right = Math.floor((x + r) / TILE);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (!isWall(level, col, row)) continue;
      if (x + r > col * TILE && x - r < (col + 1) * TILE && body.y + r > row * TILE && body.y - r < (row + 1) * TILE) {
        if (dx > 0) x = col * TILE - r;
        else if (dx < 0) x = (col + 1) * TILE + r;
      }
    }
  }
  body.x = x;
  let y = body.y + dy;
  const top2 = Math.floor((y - r) / TILE);
  const bottom2 = Math.floor((y + r) / TILE);
  const left2 = Math.floor((body.x - r) / TILE);
  const right2 = Math.floor((body.x + r) / TILE);
  for (let row = top2; row <= bottom2; row += 1) {
    for (let col = left2; col <= right2; col += 1) {
      if (!isWall(level, col, row)) continue;
      if (body.x + r > col * TILE && body.x - r < (col + 1) * TILE && y + r > row * TILE && y - r < (row + 1) * TILE) {
        if (dy > 0) y = row * TILE - r;
        else if (dy < 0) y = (row + 1) * TILE + r;
      }
    }
  }
  body.y = y;
}

// Line of sight: sample the segment; a wall tile anywhere on it blocks sight.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const col = Math.floor((x0 + (x1 - x0) * t) / TILE);
    const row = Math.floor((y0 + (y1 - y0) * t) / TILE);
    if (isWall(level, col, row)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function tileCentre(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: null,
    player: { x: 0, y: 0, radius: PLAYER.radius, angle: 0, moving: false, stance: 'walk' },
    guards: [],
    intel: [],
    keycard: null,
    exit: { x: 0, y: 0, open: false },
    detection: 0,
    spotted: false,
    caught: 0,
    timeMs: 0,
    levelTimeMs: 0,
    message: '',
    messageMs: 0,
  };

  function loadLevel(index) {
    const def = LEVELS[index];
    const level = { ...def, walls: def.map };
    state.levelIndex = index;
    state.level = level;
    state.guards = [];
    state.intel = [];
    state.keycard = null;
    state.detection = 0;
    state.spotted = false;
    state.levelTimeMs = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const ch = def.map[row][col];
        const c = tileCentre(col, row);
        if (ch === 'P') {
          state.player.x = c.x;
          state.player.y = c.y;
          state.player.angle = 0;
        } else if (ch === 'I') {
          state.intel.push({ x: c.x, y: c.y, taken: false });
        } else if (ch === 'K') {
          state.keycard = { x: c.x, y: c.y, taken: false };
        } else if (ch === 'E') {
          state.exit = { x: c.x, y: c.y, open: false };
        }
      }
    }
    state.player.startX = state.player.x;
    state.player.startY = state.player.y;
    for (const g of def.guards) {
      const first = tileCentre(g.waypoints[0][0], g.waypoints[0][1]);
      const second = tileCentre(g.waypoints[1][0], g.waypoints[1][1]);
      state.guards.push({
        x: first.x,
        y: first.y,
        radius: GUARD.radius,
        angle: Math.atan2(second.y - first.y, second.x - first.x),
        waypoints: g.waypoints.map(([c, r]) => tileCentre(c, r)),
        wp: 1,
        mode: GUARD_CALM,
        waitMs: 0,
        stuckMs: 0,
        lastX: first.x,
        lastY: first.y,
        investigate: null,
        lookMs: 0,
      });
    }
    state.message = def.name;
    state.messageMs = 2200;
  }

  function resetRun() {
    state.caught = 0;
    state.timeMs = 0;
    loadLevel(0);
  }

  function respawn() {
    state.caught += 1;
    state.player.x = state.player.startX;
    state.player.y = state.player.startY;
    state.detection = 0;
    state.spotted = false;
    for (const g of state.guards) {
      const first = g.waypoints[0];
      g.x = first.x;
      g.y = first.y;
      g.wp = 1;
      g.mode = GUARD_CALM;
      g.investigate = null;
      g.waitMs = 0;
      g.stuckMs = 0;
      const second = g.waypoints[1];
      g.angle = Math.atan2(second.y - first.y, second.x - first.x);
    }
    state.message = 'CAUGHT! Back to the start of this level.';
    state.messageMs = 2200;
  }

  function guardSeesPlayer(guard) {
    const p = state.player;
    const dx = p.x - guard.x;
    const dy = p.y - guard.y;
    const dist = Math.hypot(dx, dy);
    const range = GUARD.viewRange * (p.stance === 'sneak' ? GUARD.sneakRangeFactor : 1);
    if (dist > range) return 0;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.viewHalfAngle) return 0;
    if (!hasLineOfSight(state.level, guard.x, guard.y, p.x, p.y)) return 0;
    // Closer and more exposed fills the meter faster; running is loud AND visible.
    const closeness = 1 - dist / range;
    const stanceFactor = p.stance === 'run' ? 1.5 : p.stance === 'sneak' ? 0.55 : 1;
    return (0.35 + 0.65 * closeness) * stanceFactor;
  }

  function stepGuard(guard, dt, events) {
    const p = state.player;
    const seen = guardSeesPlayer(guard);
    if (seen > 0) {
      state.detection = Math.min(100, state.detection + GUARD.detectRate * seen * dt);
      if (state.detection >= GUARD.suspiciousAt && guard.mode === GUARD_CALM) {
        guard.mode = GUARD_SUSPICIOUS;
      }
      if (state.detection >= 100 && !state.spotted) {
        state.spotted = true;
        events |= EVENT_SPOTTED;
        state.message = 'SPOTTED! Break line of sight!';
        state.messageMs = 1800;
      }
    }
    if (state.spotted) guard.mode = GUARD_ALERT;

    let target = null;
    let speed = GUARD.patrol;
    if (guard.mode === GUARD_ALERT) {
      target = { x: p.x, y: p.y };
      speed = GUARD.chase;
      guard.angle = Math.atan2(p.y - guard.y, p.x - guard.x);
    } else if (guard.mode === GUARD_SUSPICIOUS && guard.investigate) {
      target = guard.investigate;
      speed = GUARD.investigate;
      if (Math.hypot(target.x - guard.x, target.y - guard.y) < 14) {
        guard.lookMs -= dt * 1000;
        guard.angle += dt * 1.6;
        if (guard.lookMs <= 0) {
          guard.mode = GUARD_CALM;
          guard.investigate = null;
        }
        target = null;
      }
    } else {
      target = guard.waypoints[guard.wp];
      if (Math.hypot(target.x - guard.x, target.y - guard.y) < 10) {
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
        target = guard.waypoints[guard.wp];
        guard.waitMs = 500;
      }
    }
    if (guard.waitMs > 0) {
      guard.waitMs -= dt * 1000;
      return events;
    }
    if (target) {
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const step = Math.min(dist, speed * dt);
        const nx = (dx / dist) * step;
        const ny = (dy / dist) * step;
        moveCircle(state.level, guard, nx, ny);
        if (guard.mode !== GUARD_ALERT) {
          guard.angle = Math.atan2(dy, dx);
        }
      }
      // Stuck against a wall: give up on this waypoint and take the next.
      const moved = Math.hypot(guard.x - guard.lastX, guard.y - guard.lastY);
      if (moved < speed * dt * 0.25) guard.stuckMs += dt * 1000;
      else guard.stuckMs = 0;
      guard.lastX = guard.x;
      guard.lastY = guard.y;
      if (guard.stuckMs > 1200) {
        guard.stuckMs = 0;
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
        guard.investigate = null;
        if (guard.mode === GUARD_SUSPICIOUS) guard.mode = GUARD_CALM;
      }
    }
    return events;
  }

  function step(dt, move, running, sneaking) {
    let events = 0;
    state.timeMs += dt * 1000;
    state.levelTimeMs += dt * 1000;
    if (state.messageMs > 0) state.messageMs -= dt * 1000;

    const p = state.player;
    const stance = running ? 'run' : sneaking ? 'sneak' : 'walk';
    p.stance = stance;
    const speed = stance === 'run' ? PLAYER.run : stance === 'sneak' ? PLAYER.sneak : PLAYER.walk;
    const moving = move.x !== 0 || move.y !== 0;
    p.moving = moving;
    if (moving) {
      moveCircle(state.level, p, move.x * speed * dt, move.y * speed * dt);
      p.angle = Math.atan2(move.y, move.x);
      // Running is loud: guards in earshot come to look.
      const noise = stance === 'run' ? PLAYER.noiseRun : stance === 'walk' ? PLAYER.noiseWalk : PLAYER.noiseSneak;
      if (noise > 0) {
        for (const g of state.guards) {
          if (g.mode === GUARD_CALM && Math.hypot(g.x - p.x, g.y - p.y) < noise) {
            g.mode = GUARD_SUSPICIOUS;
            g.investigate = { x: p.x, y: p.y };
            g.lookMs = 2000;
            events |= EVENT_HEARD;
          }
        }
      }
    }

    // Detection drains when nobody sees the player; the chase ends with it.
    let anyoneSees = false;
    for (const g of state.guards) {
      if (guardSeesPlayer(g) > 0) anyoneSees = true;
    }
    if (!anyoneSees) {
      state.detection = Math.max(0, state.detection - GUARD.detectDecay * dt);
      if (state.spotted && state.detection < 40) {
        state.spotted = false;
        for (const g of state.guards) {
          if (g.mode === GUARD_ALERT) {
            g.mode = GUARD_SUSPICIOUS;
            g.investigate = { x: p.x, y: p.y };
            g.lookMs = 1500;
          }
        }
        state.message = 'Lost them. Stay low.';
        state.messageMs = 1500;
      }
    }
    for (const g of state.guards) events = stepGuard(g, dt, events);

    // Caught: an alert guard closes the distance.
    if (state.spotted) {
      for (const g of state.guards) {
        if (g.mode === GUARD_ALERT && Math.hypot(g.x - p.x, g.y - p.y) < GUARD.catchDistance) {
          respawn();
          return EVENT_CAUGHT;
        }
      }
    }

    // Pickups.
    for (const item of state.intel) {
      if (!item.taken && Math.hypot(item.x - p.x, item.y - p.y) < 24) {
        item.taken = true;
        events |= EVENT_PICKUP;
      }
    }
    if (state.keycard && !state.keycard.taken && Math.hypot(state.keycard.x - p.x, state.keycard.y - p.y) < 24) {
      state.keycard.taken = true;
      events |= EVENT_PICKUP;
    }
    const intelLeft = state.intel.filter((i) => !i.taken).length;
    const keyNeeded = state.keycard && !state.keycard.taken;
    state.exit.open = intelLeft === 0 && !keyNeeded;
    if (state.exit.open && Math.hypot(state.exit.x - p.x, state.exit.y - p.y) < 26) {
      return events | EVENT_LEVEL_CLEAR;
    }
    return events;
  }

  function objectiveText() {
    const intelLeft = state.intel.filter((i) => !i.taken).length;
    const parts = [];
    if (intelLeft > 0) parts.push(`Intel ${state.intel.length - intelLeft}/${state.intel.length}`);
    if (state.keycard) parts.push(state.keycard.taken ? 'Keycard ✓' : 'Keycard ✗');
    if (state.exit.open) parts.push('→ EXIT OPEN');
    return parts.join('  ·  ');
  }

  function alertText() {
    if (state.spotted) return 'ALERT — RUN!';
    if (state.detection >= GUARD.suspiciousAt) return 'SUSPICIOUS';
    return 'UNDETECTED';
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    resetRun,
    step,
    objectiveText,
    alertText,
    levelCount: LEVELS.length,
  };
}
