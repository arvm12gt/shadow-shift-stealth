// Shadow Shift renderer: dark floors, amber light pools, red vision cones.
// Everything is drawn with canvas primitives — no external assets.
import { COLS, GUARD, ROWS, TILE } from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const W = COLS * TILE;
const H = ROWS * TILE;

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  function drawFloor(level) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = col * TILE;
        const y = row * TILE;
        if (level.map[row][col] === '#') {
          ctx.fillStyle = '#232733';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#2e3345';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = '#1a1d29';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#12141d' : '#101219';
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  function drawCone(guard) {
    const range = GUARD.viewRange;
    const a0 = guard.angle - GUARD.viewHalfAngle;
    const a1 = guard.angle + GUARD.viewHalfAngle;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, range, a0, a1);
    ctx.closePath();
    ctx.fillStyle = guard.mode === GUARD_ALERT
      ? 'rgba(255, 64, 64, 0.20)'
      : guard.mode === GUARD_SUSPICIOUS
        ? 'rgba(255, 190, 60, 0.16)'
        : 'rgba(255, 220, 110, 0.10)';
    ctx.fill();
  }

  function drawExit(exit) {
    ctx.save();
    ctx.translate(exit.x, exit.y);
    ctx.fillStyle = exit.open ? '#37d67a' : '#5a6274';
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = '#0b0e14';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 0, 1);
    if (exit.open) {
      ctx.strokeStyle = 'rgba(55, 214, 122, 0.7)';
      ctx.lineWidth = 2;
      const pulse = 18 + Math.sin(Date.now() / 300) * 4;
      ctx.strokeRect(-pulse, -pulse, pulse * 2, pulse * 2);
    }
    ctx.restore();
  }

  function drawGuard(guard) {
    // Body.
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
    ctx.fillStyle = guard.mode === GUARD_ALERT ? '#e5484d' : guard.mode === GUARD_SUSPICIOUS ? '#f5a524' : '#8a93a8';
    ctx.fill();
    ctx.strokeStyle = '#0b0e14';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick.
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * (guard.radius + 7), guard.y + Math.sin(guard.angle) * (guard.radius + 7));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Alert mark.
    if (guard.mode !== 0) {
      ctx.fillStyle = guard.mode === GUARD_ALERT ? '#ff5a5a' : '#ffc53d';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(guard.mode === GUARD_ALERT ? '!' : '?', guard.x, guard.y - guard.radius - 4);
    }
  }

  function drawPlayer(player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#4cc2ff';
    ctx.fill();
    ctx.strokeStyle = '#0b0e14';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Sneak: a ring; run: motion ticks.
    if (player.stance === 'sneak') {
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(76, 194, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(player.angle) * (player.radius + 6), Math.sin(player.angle) * (player.radius + 6));
    ctx.strokeStyle = '#dff3ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawHud(state, world) {
    ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.level.name, 12, 17);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(world.objectiveText(), W / 2, 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = state.spotted ? '#ff5a5a' : state.detection >= 30 ? '#ffc53d' : '#7ee2a8';
    ctx.fillText(`${world.alertText()}  ·  ${fmtTime(state.timeMs)}  ·  Caught ${state.caught}`, W - 12, 17);

    // Detection meter, bottom centre.
    const mw = 260;
    const mx = (W - mw) / 2;
    const my = H - 22;
    ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
    ctx.fillRect(mx - 8, my - 8, mw + 16, 22);
    ctx.fillStyle = '#262a38';
    ctx.fillRect(mx, my, mw, 6);
    const frac = state.detection / 100;
    ctx.fillStyle = frac >= 1 ? '#ff4040' : frac >= 0.3 ? '#ffc53d' : '#7ee2a8';
    ctx.fillRect(mx, my, mw * frac, 6);
    ctx.fillStyle = '#c9cede';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`DETECTION  ${Math.round(state.detection)}%   ·   ${state.player.stance.toUpperCase()}`, W / 2, my - 12 + 22);
  }

  function drawMessage(state) {
    if (state.messageMs <= 0 || !state.message) return;
    ctx.fillStyle = 'rgba(5, 6, 10, 0.78)';
    const tw = ctx.measureText(state.message).width + 36;
    ctx.fillRect((W - tw) / 2, 46, tw, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.message, W / 2, 61);
  }

  function dim() {
    ctx.fillStyle = 'rgba(4, 5, 9, 0.82)';
    ctx.fillRect(0, 0, W, H);
  }

  function title(text, sub, lines, foot) {
    dim();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 44px monospace';
    ctx.fillText(text, W / 2, H / 2 - 120);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = '16px monospace';
    ctx.fillText(sub, W / 2, H / 2 - 78);
    ctx.fillStyle = '#c9cede';
    ctx.font = '14px monospace';
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, H / 2 - 34 + i * 24);
    });
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(foot, W / 2, H / 2 + 118);
  }

  function draw(state, world, screen, extra) {
    const level = state.level;
    if (!level) return;
    ctx.clearRect(0, 0, W, H);
    drawFloor(level);
    for (const item of state.intel) {
      if (item.taken) continue;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b0e14';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('i', item.x, item.y + 0.5);
    }
    if (state.keycard && !state.keycard.taken) {
      ctx.fillStyle = '#b78cff';
      ctx.fillRect(state.keycard.x - 9, state.keycard.y - 6, 18, 12);
      ctx.fillStyle = '#0b0e14';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KEY', state.keycard.x, state.keycard.y + 0.5);
    }
    drawExit(state.exit);
    for (const g of state.guards) drawCone(g);
    for (const g of state.guards) drawGuard(g);
    drawPlayer(state.player);
    // Noise ring while running.
    if (state.player.stance === 'run' && state.player.moving) {
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 125, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    drawHud(state, world);
    if (screen === SCREEN_PLAY) drawMessage(state);

    if (screen === SCREEN_TITLE) {
      title('SHADOW SHIFT', 'A stealth game in three levels', [
        'WASD / arrows — move      SHIFT — run (loud!)',
        'C / CTRL — sneak (slow, silent, harder to see)',
        'Stay out of the red vision cones. Fill the meter, get chased.',
        'Grab every intel file (and the keycard) to open the exit.',
        'Caught? You restart the level. Three levels, one clean run.',
      ], 'Press SPACE to begin');
    } else if (screen === SCREEN_PAUSED) {
      title('PAUSED', 'Take a breath. The guards wait for no one.', [], 'Press P to resume');
    } else if (screen === SCREEN_LEVEL_CLEAR) {
      title('LEVEL CLEAR', extra?.levelName ?? '', [
        `Level time  ${fmtTime(extra?.levelMs ?? 0)}`,
        `Times caught so far  ${state.caught}`,
        '',
        'The next floor is darker — and better guarded.',
      ], 'Press SPACE for the next level');
    } else if (screen === SCREEN_WIN) {
      const best = extra?.bestMs;
      title('CLEAN GETAWAY', 'All three levels cleared', [
        `Total time  ${fmtTime(state.timeMs)}`,
        `Times caught  ${state.caught}`,
        best != null ? `Best time  ${fmtTime(best)}` : '',
        '',
        'Not a single alarm that mattered. The vault is yours.',
      ], 'Press SPACE to play again');
    }
  }

  return { draw, fit, width: W, height: H };
}
