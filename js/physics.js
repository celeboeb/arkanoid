/**
 * Fixed-step Arkanoid physics.
 * Circle vs AABB is solved analytically (flat faces + corner arcs) and
 * backed by a binary search so a fast ball cannot tunnel.
 *
 * Paddle contract: paddle.x / paddle.y are the pose at the START of the step.
 * paddle.vx is constant over the step. stepWorld advances paddle.x.
 */

export const FIELD_W = 360;
export const FIELD_H = 640;
export const BALL_R = 6.5;
export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;

/** Radians from horizontal. Keeps the ball from skating or drilling vertically. */
export const MIN_ANGLE = (18 * Math.PI) / 180;
export const MAX_ANGLE = (72 * Math.PI) / 180;

const SKIN = 0.05;
const MAX_ITERS = 20;

export function angleFromHorizontal(vx, vy) {
  return Math.atan2(Math.abs(vy), Math.abs(vx));
}

export function clampVelocity(vx, vy, speed) {
  let sp = speed;
  if (!(sp > 0)) sp = Math.hypot(vx, vy);
  if (!(sp > 0)) sp = 1;
  let ang = Math.atan2(Math.abs(vy), Math.abs(vx));
  if (!Number.isFinite(ang)) ang = (MIN_ANGLE + MAX_ANGLE) * 0.5;
  if (ang < MIN_ANGLE) ang = MIN_ANGLE;
  if (ang > MAX_ANGLE) ang = MAX_ANGLE;
  const sx = vx < 0 ? -1 : 1;
  const sy = vy < 0 ? -1 : vy > 0 ? 1 : -1;
  return {
    vx: Math.cos(ang) * sp * sx,
    vy: Math.sin(ang) * sp * sy,
  };
}

/** Fraction of the base speed added per second inside a level. */
export const SPEED_TIME_RATE = 0.012;
/** Fraction of the base speed added per brick hit. */
export const SPEED_HIT_RATE = 0.0022;

/** Target speed grows with time and brick hits, then stops at the cap. */
export function rampSpeed(base, levelTime, hits, cap) {
  const target = base * (1 + levelTime * SPEED_TIME_RATE + hits * SPEED_HIT_RATE);
  return Math.min(cap, target);
}

export function createWorld(partial = {}) {
  const w = partial.w ?? FIELD_W;
  const h = partial.h ?? FIELD_H;
  const paddle = partial.paddle ?? {
    x: w / 2,
    y: h - 36,
    w: 86,
    h: 14,
    vx: 0,
  };
  return {
    w,
    h,
    bricks: partial.bricks ?? [],
    balls: partial.balls ?? [],
    paddle,
    solidBottom: partial.solidBottom ?? false,
    sticky: partial.sticky ?? false,
    events: [],
  };
}

export function makeBrick(partial) {
  const brick = {
    alive: true,
    kind: 'metal',
    hp: Infinity,
    maxHp: Infinity,
    points: 0,
    color: 9,
    row: 0,
    col: 0,
    id: 0,
    ...partial,
  };
  if (brick.maxHp == null || !Number.isFinite(brick.maxHp)) brick.maxHp = brick.hp;
  return brick;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/** Outward penetration of a circle against an AABB. Null when separated. */
export function overlapInfo(x, y, r, box) {
  const x1 = box.x;
  const y1 = box.y;
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;
  const cx = clamp(x, x1, x2);
  const cy = clamp(y, y1, y2);
  let dx = x - cx;
  let dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 < r * r - 1e-8) {
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      return { pen: r - d, nx: dx / d, ny: dy / d };
    }
    const left = x - x1;
    const right = x2 - x;
    const top = y - y1;
    const bot = y2 - y;
    const m = Math.min(left, right, top, bot);
    if (m === left) return { pen: r + left, nx: -1, ny: 0 };
    if (m === right) return { pen: r + right, nx: 1, ny: 0 };
    if (m === top) return { pen: r + top, nx: 0, ny: -1 };
    return { pen: r + bot, nx: 0, ny: 1 };
  }
  return null;
}

function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx;
  const fy = oy - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-16) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < -1e-8) return null;
  if (disc < 0) disc = 0;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  if (t1 >= -1e-7) return t1 < 0 ? 0 : t1;
  return null;
}

/**
 * Earliest contact of a moving circle against a static AABB in time [0, dt].
 * kind is "face" or "corner". Normal points out of the box.
 */
export function sweepCircleAABB(x, y, r, vx, vy, dt, box) {
  if (!(dt >= 0)) return null;
  const x1 = box.x;
  const y1 = box.y;
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;
  let best = null;

  function consider(t, nx, ny, kind) {
    if (!Number.isFinite(t) || t < -1e-7 || t > dt + 1e-8) return;
    if (t < 0) t = 0;
    const px = x + vx * t;
    const py = y + vy * t;
    // Reject hits that only graze the infinite line outside the feature.
    if (kind === 'face') {
      if (nx !== 0 && (py < y1 - 1e-4 || py > y2 + 1e-4)) return;
      if (ny !== 0 && (px < x1 - 1e-4 || px > x2 + 1e-4)) return;
    }
    if (vx * nx + vy * ny >= -1e-6) return;
    if (!best || t < best.t - 1e-10) best = { t, nx, ny, kind };
  }

  if (vy !== 0) {
    const tTop = (y1 - r - y) / vy;
    consider(tTop, 0, -1, 'face');
    const tBot = (y2 + r - y) / vy;
    consider(tBot, 0, 1, 'face');
  }
  if (vx !== 0) {
    const tLeft = (x1 - r - x) / vx;
    consider(tLeft, -1, 0, 'face');
    const tRight = (x2 + r - x) / vx;
    consider(tRight, 1, 0, 'face');
  }

  const corners = [
    [x1, y1],
    [x2, y1],
    [x1, y2],
    [x2, y2],
  ];
  for (let i = 0; i < 4; i++) {
    const cx = corners[i][0];
    const cy = corners[i][1];
    const t = rayCircle(x, y, vx, vy, cx, cy, r);
    if (t == null) continue;
    const hx = x + vx * t - cx;
    const hy = y + vy * t - cy;
    const len = Math.hypot(hx, hy) || 1;
    consider(t, hx / len, hy / len, 'corner');
  }
  return best;
}

function bounce(ball, nx, ny) {
  const dot = ball.vx * nx + ball.vy * ny;
  let vx = ball.vx;
  let vy = ball.vy;
  if (dot < 0) {
    vx -= 2 * dot * nx;
    vy -= 2 * dot * ny;
  }
  let v = clampVelocity(vx, vy, ball.speed);
  if (v.vx * nx + v.vy * ny <= ball.speed * 0.02) {
    v = clampVelocity(v.vx + nx * ball.speed, v.vy + ny * ball.speed, ball.speed);
  }
  if (v.vx * nx + v.vy * ny <= 0) {
    const tx = -ny;
    const ty = nx;
    const side = Math.sign(ball.vx * tx + ball.vy * ty) || 1;
    v = clampVelocity(nx * 0.5 + tx * side, ny * 0.5 + ty * side, ball.speed);
  }
  ball.vx = v.vx;
  ball.vy = v.vy;
}

function arkanoidBounce(world, ball, paddleX) {
  const p = world.paddle;
  const half = p.w / 2 + ball.r;
  let t = half > 0 ? (ball.x - paddleX) / half : 0;
  if (t > 1) t = 1;
  if (t < -1) t = -1;
  const fromHoriz = MAX_ANGLE + (MIN_ANGLE - MAX_ANGLE) * Math.abs(t);
  const sx = Math.abs(t) < 0.06 ? (ball.vx < 0 ? -1 : 1) : Math.sign(t) || 1;
  let vx = Math.cos(fromHoriz) * ball.speed * sx;
  const vy = -Math.sin(fromHoriz) * ball.speed;
  const pvx = clamp(p.vx || 0, -520, 520);
  vx += pvx * 0.3;
  const v = clampVelocity(vx, vy, ball.speed);
  ball.vx = v.vx;
  ball.vy = -Math.abs(v.vy);
  return t;
}

function paddleBox(world, tau) {
  const p = world.paddle;
  const cx = p.x + (p.vx || 0) * tau;
  return { x: cx - p.w / 2, y: p.y, w: p.w, h: p.h, cx };
}

function consider(best, hit) {
  if (!hit || !Number.isFinite(hit.t)) return best;
  if (hit.t < -1e-7 || hit.t > hit.dt + 1e-8) return best;
  if (hit.t < 0) hit.t = 0;
  if (!best || hit.t < best.t - 1e-10) return hit;
  return best;
}

function queryHit(world, ball, time, tau) {
  let best = null;
  const dt = time;

  for (let i = 0; i < world.bricks.length; i++) {
    const brick = world.bricks[i];
    if (!brick.alive) continue;
    const o = overlapInfo(ball.x, ball.y, ball.r, brick);
    if (o && o.pen > 0.03) {
      best = consider(best, {
        t: 0,
        dt,
        nx: o.nx,
        ny: o.ny,
        pen: o.pen,
        type: 'overlap',
        brick,
      });
    }
  }

  const paddle = world.paddle;
  if (paddle && ball.y <= paddle.y + ball.r * 0.35) {
    const box = paddleBox(world, tau);
    const o = overlapInfo(ball.x, ball.y, ball.r, box);
    if (o && o.pen > 0.03 && o.ny < -0.2) {
      best = consider(best, {
        t: 0,
        dt,
        nx: o.nx,
        ny: o.ny,
        pen: o.pen,
        type: 'overlap',
        paddle: true,
        paddleX: box.cx,
      });
    }
  }

  if (best && best.type === 'overlap') return best;

  for (let i = 0; i < world.bricks.length; i++) {
    const brick = world.bricks[i];
    if (!brick.alive) continue;
    const h = sweepCircleAABB(ball.x, ball.y, ball.r, ball.vx, ball.vy, dt, brick);
    if (!h) continue;
    best = consider(best, { ...h, dt, type: 'brick', brick });
  }

  const r = ball.r;
  const { vx, vy } = ball;
  if (vx < 0) {
    best = consider(best, { t: (r - ball.x) / vx, dt, nx: 1, ny: 0, type: 'wall' });
  }
  if (vx > 0) {
    best = consider(best, { t: (world.w - r - ball.x) / vx, dt, nx: -1, ny: 0, type: 'wall' });
  }
  if (vy < 0) {
    best = consider(best, { t: (r - ball.y) / vy, dt, nx: 0, ny: 1, type: 'wall' });
  }
  if (vy > 0) {
    if (world.solidBottom) {
      best = consider(best, {
        t: (world.h - r - ball.y) / vy,
        dt,
        nx: 0,
        ny: -1,
        type: 'wall',
      });
    } else {
      best = consider(best, { t: (world.h - ball.y) / vy, dt, nx: 0, ny: -1, type: 'miss' });
    }
  }

  if (paddle && ball.y <= paddle.y + ball.r * 0.35) {
    const box = paddleBox(world, tau);
    const rvx = ball.vx - (paddle.vx || 0);
    const h = sweepCircleAABB(ball.x, ball.y, ball.r, rvx, ball.vy, dt, box);
    if (h && h.ny < -0.15) {
      best = consider(best, {
        ...h,
        dt,
        type: 'paddle',
        paddle: true,
        paddleX: box.cx + (paddle.vx || 0) * h.t,
      });
    }
  }

  // Discard wall/brick hits we are not moving into (sweep already filters, miss does not).
  if (best && best.type !== 'miss' && best.type !== 'overlap') {
    if (ball.vx * best.nx + ball.vy * best.ny >= -1e-6) return null;
  }
  return best;
}

function damageBrick(world, ball, brick) {
  if (!brick || !brick.alive) return;
  if (brick.kind === 'metal') {
    world.events.push({ type: 'metal', brick, ball });
    return;
  }
  if (!ball._hit) ball._hit = new Set();
  if (ball._hit.has(brick)) return;
  ball._hit.add(brick);
  brick.hp -= 1;
  if (brick.hp <= 0) {
    brick.alive = false;
    world.events.push({ type: 'brick-break', brick, ball });
  } else {
    world.events.push({ type: 'brick-hit', brick, ball });
  }
}

function applyResponse(world, ball, hit) {
  if (hit.type === 'miss') {
    ball.alive = false;
    world.events.push({ type: 'miss', ball });
    return;
  }
  if (hit.paddle || hit.type === 'paddle') {
    if (world.sticky && hit.ny < -0.35) {
      ball.stuck = true;
      const px = hit.paddleX ?? world.paddle.x;
      ball.stuckDx = ball.x - px;
      ball.vx = 0;
      ball.vy = 0;
      world.events.push({ type: 'paddle-stick', ball });
      return;
    }
    if (hit.ny < -0.45) {
      const offsetT = arkanoidBounce(world, ball, hit.paddleX ?? world.paddle.x);
      world.events.push({ type: 'paddle', ball, offsetT });
    } else {
      bounce(ball, hit.nx, hit.ny);
      world.events.push({ type: 'paddle', ball, offsetT: 0 });
    }
    return;
  }
  if (hit.type === 'wall') {
    bounce(ball, hit.nx, hit.ny);
    world.events.push({ type: 'wall', ball });
    return;
  }
  damageBrick(world, ball, hit.brick);
  if (hit.nx || hit.ny) bounce(ball, hit.nx, hit.ny);
}

export function maxPenetration(world, x, y, r) {
  let m = 0;
  for (let i = 0; i < world.bricks.length; i++) {
    const brick = world.bricks[i];
    if (!brick.alive) continue;
    const o = overlapInfo(x, y, r, brick);
    if (o && o.pen > m) m = o.pen;
  }
  return m;
}

export function ballPenetration(world, ball) {
  return maxPenetration(world, ball.x, ball.y, ball.r);
}

function positionIllegal(world, ball, x, y, tau) {
  const r = ball.r;
  if (x < r - 0.02 || x > world.w - r + 0.02 || y < r - 0.02) return true;
  if (world.solidBottom && y > world.h - r + 0.02) return true;
  if (!world.solidBottom && y > world.h + 0.02) return true;
  if (maxPenetration(world, x, y, r) > 0.4) return true;
  const p = world.paddle;
  if (p && y <= p.y + 1) {
    const box = paddleBox(world, tau);
    const o = overlapInfo(x, y, r, box);
    if (o && o.pen > 0.4 && o.ny < -0.15) return true;
  }
  return false;
}

function pushOut(world, ball) {
  let sx = 0;
  let sy = 0;
  let maxPen = 0;
  let any = false;
  for (let i = 0; i < world.bricks.length; i++) {
    const brick = world.bricks[i];
    if (!brick.alive) continue;
    const o = overlapInfo(ball.x, ball.y, ball.r, brick);
    if (!o) continue;
    any = true;
    sx += o.nx * o.pen;
    sy += o.ny * o.pen;
    if (o.pen > maxPen) maxPen = o.pen;
  }
  if (!any) return false;
  const len = Math.hypot(sx, sy);
  if (len < 1e-6) {
    const sp = Math.hypot(ball.vx, ball.vy) || 1;
    ball.x -= (ball.vx / sp) * (maxPen + 0.4);
    ball.y -= (ball.vy / sp) * (maxPen + 0.4);
  } else {
    ball.x += (sx / len) * (maxPen + SKIN);
    ball.y += (sy / len) * (maxPen + SKIN);
  }
  return true;
}

function integrate(world, ball, dt) {
  let time = dt;
  let tau = 0;
  let safeX = ball.x;
  let safeY = ball.y;
  let safe = maxPenetration(world, ball.x, ball.y, ball.r) < 0.3;

  for (let iter = 0; iter < MAX_ITERS && time > 1e-5; iter++) {
    const hit = queryHit(world, ball, time, tau);
    if (!hit) {
      const nx = ball.x + ball.vx * time;
      const ny = ball.y + ball.vy * time;
      if (positionIllegal(world, ball, nx, ny, tau + time)) {
        const x0 = ball.x;
        const y0 = ball.y;
        let lo = 0;
        let hi = time;
        for (let s = 0; s < 14; s++) {
          const mid = (lo + hi) * 0.5;
          const x = x0 + ball.vx * mid;
          const y = y0 + ball.vy * mid;
          if (positionIllegal(world, ball, x, y, tau + mid)) hi = mid;
          else lo = mid;
        }
        if (lo < 1e-5) {
          pushOut(world, ball);
          ball.vy = -Math.abs(ball.vy) || -ball.speed;
          const v = clampVelocity(ball.vx || ball.speed, ball.vy, ball.speed);
          ball.vx = v.vx;
          ball.vy = v.vy;
          time *= 0.5;
          continue;
        }
        ball.x = x0 + ball.vx * lo;
        ball.y = y0 + ball.vy * lo;
        tau += lo;
        time -= lo;
        continue;
      }
      ball.x = nx;
      ball.y = ny;
      time = 0;
      safeX = ball.x;
      safeY = ball.y;
      safe = true;
      break;
    }

    if (hit.type === 'overlap') {
      ball.x += hit.nx * (hit.pen + SKIN);
      ball.y += hit.ny * (hit.pen + SKIN);
      applyResponse(world, ball, hit);
      if (ball.alive === false || ball.stuck) return;
      continue;
    }

    const t = Math.min(time, Math.max(0, hit.t));
    ball.x += ball.vx * t + (hit.nx || 0) * SKIN;
    ball.y += ball.vy * t + (hit.ny || 0) * SKIN;
    tau += t;
    time -= t;
    applyResponse(world, ball, hit);
    if (ball.alive === false || ball.stuck) return;
    if (maxPenetration(world, ball.x, ball.y, ball.r) < 0.3) {
      safeX = ball.x;
      safeY = ball.y;
      safe = true;
    }
  }

  for (let i = 0; i < 6 && maxPenetration(world, ball.x, ball.y, ball.r) > 0.25; i++) {
    if (!pushOut(world, ball)) break;
  }
  if (maxPenetration(world, ball.x, ball.y, ball.r) > 0.45 && safe) {
    ball.x = safeX;
    ball.y = safeY;
    ball.vy = -Math.abs(ball.vy) || -Math.sin(MIN_ANGLE) * ball.speed;
    const v = clampVelocity(ball.vx || ball.speed, ball.vy, ball.speed);
    ball.vx = v.vx;
    ball.vy = v.vy;
  }

  if (ball.x < ball.r) {
    ball.x = ball.r;
    if (ball.vx < 0) ball.vx = Math.abs(ball.vx);
  } else if (ball.x > world.w - ball.r) {
    ball.x = world.w - ball.r;
    if (ball.vx > 0) ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < ball.r) {
    ball.y = ball.r;
    if (ball.vy < 0) ball.vy = Math.abs(ball.vy);
  }
  const v = clampVelocity(ball.vx, ball.vy, ball.speed);
  ball.vx = v.vx;
  ball.vy = v.vy;
}

export function stepWorld(world, dt) {
  world.events = [];
  if (!(dt > 0)) return world.events;
  const balls = world.balls;
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (ball.alive === false || ball.stuck) continue;
    if (!(ball.r > 0)) ball.r = BALL_R;
    if (!(ball.speed > 0)) ball.speed = Math.hypot(ball.vx, ball.vy) || 1;
    const v = clampVelocity(ball.vx, ball.vy, ball.speed);
    ball.vx = v.vx;
    ball.vy = v.vy;
    ball._hit = new Set();
    integrate(world, ball, dt);
  }
  const p = world.paddle;
  if (p) {
    p.x += (p.vx || 0) * dt;
    const minX = p.w / 2;
    const maxX = world.w - p.w / 2;
    if (p.x < minX) p.x = minX;
    if (p.x > maxX) p.x = maxX;
  }
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (!ball.stuck || !p) continue;
    const limit = Math.max(0, p.w / 2 - 4);
    ball.stuckDx = clamp(ball.stuckDx || 0, -limit, limit);
    ball.x = p.x + ball.stuckDx;
    ball.y = p.y - ball.r - 1.25;
    ball.vx = 0;
    ball.vy = 0;
  }
  world.balls = balls.filter((b) => b.alive !== false);
  return world.events;
}

export function launchStuck(world, ball, direction = 1) {
  const p = world.paddle;
  ball.stuck = false;
  const half = p.w / 2 + ball.r;
  const t = half > 0 ? clamp((ball.stuckDx || 0) / half, -1, 1) : 0;
  const fromHoriz = MAX_ANGLE + (MIN_ANGLE - MAX_ANGLE) * Math.abs(t) * 0.85;
  const sx = Math.abs(t) < 0.08 ? (direction < 0 ? -1 : 1) : Math.sign(t);
  const v = clampVelocity(Math.cos(fromHoriz) * sx, -Math.sin(fromHoriz), ball.speed);
  ball.vx = v.vx;
  ball.vy = -Math.abs(v.vy);
  ball.y = p.y - ball.r - 2;
  ball.x = p.x + (ball.stuckDx || 0);
}
