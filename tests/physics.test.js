import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  MAX_ANGLE,
  MIN_ANGLE,
  angleFromHorizontal,
  ballPenetration,
  clampVelocity,
  createWorld,
  makeBrick,
  rampSpeed,
  stepWorld,
  sweepCircleAABB,
} from '../js/physics.js';
import { createBricks, validateLevelDefs, LEVELS } from '../js/levels.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function angOk(ball) {
  const ang = angleFromHorizontal(ball.vx, ball.vy);
  const sp = Math.hypot(ball.vx, ball.vy);
  assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y), 'finite position');
  assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy), 'finite velocity');
  assert.ok(ang >= MIN_ANGLE - 1e-3 && ang <= MAX_ANGLE + 1e-3, `angle ${ang}`);
  assert.ok(Math.abs(sp - ball.speed) / ball.speed < 0.03, `speed ${sp} vs ${ball.speed}`);
}

test('face sweep hits the near side and reports an outward normal', () => {
  const box = { x: 100, y: 100, w: 40, h: 20 };
  const hit = sweepCircleAABB(120, 150, 6, 0, -200, 1, box);
  assert.ok(hit);
  assert.equal(hit.kind, 'face');
  assert.equal(hit.nx, 0);
  assert.equal(hit.ny, 1);
  assert.ok(Math.abs(hit.t - (126 - 150) / -200) < 1e-6);
});

test('corner sweep is not classified as a flat face', () => {
  const box = { x: 100, y: 100, w: 40, h: 20 };
  // Aim at the bottom-left corner arc from below-left.
  const hit = sweepCircleAABB(86, 140, 6, 70, -90, 1, box);
  assert.ok(hit, 'expected a hit');
  assert.equal(hit.kind, 'corner');
  assert.ok(Math.abs(hit.nx) > 0.25 && Math.abs(hit.ny) > 0.25, `normal ${hit.nx},${hit.ny}`);
});

test('clampVelocity enforces the angle window and the requested speed', () => {
  const v = clampVelocity(1000, -0.01, 400);
  const ang = angleFromHorizontal(v.vx, v.vy);
  assert.ok(ang >= MIN_ANGLE - 1e-9 && ang <= MAX_ANGLE + 1e-9);
  assert.ok(Math.abs(Math.hypot(v.vx, v.vy) - 400) < 1e-6);
  assert.ok(v.vy < 0);
  const steep = clampVelocity(0.01, -500, 300);
  assert.ok(angleFromHorizontal(steep.vx, steep.vy) <= MAX_ANGLE + 1e-9);
});

test('speed ramps smoothly and respects the cap', () => {
  const base = 300;
  const cap = base * 1.7;
  let prev = rampSpeed(base, 0, 0, cap);
  assert.equal(prev, base);
  for (let t = 0.5; t <= 40; t += 0.5) {
    const s = rampSpeed(base, t, t * 2, cap);
    assert.ok(s + 1e-9 >= prev);
    assert.ok(s <= cap + 1e-9);
    prev = s;
  }
  assert.equal(rampSpeed(base, 100, 100, cap), cap);
});

test('a point-blank fast serve cannot pass through a brick', () => {
  const brick = makeBrick({
    x: 80,
    y: 200,
    w: 200,
    h: 22,
    kind: 'normal',
    hp: 3,
    maxHp: 3,
  });
  const speed = 9000;
  const ang = (50 * Math.PI) / 180;
  const world = createWorld({
    bricks: [brick],
    balls: [
      {
        x: 180,
        y: 200 + 22 + BALL_R + 1,
        vx: Math.cos(ang) * speed,
        vy: -Math.sin(ang) * speed,
        r: BALL_R,
        speed,
        alive: true,
      },
    ],
    paddle: { x: 180, y: 600, w: 90, h: 14, vx: 0 },
  });
  const events = stepWorld(world, 1 / 120);
  const ball = world.balls[0];
  assert.ok(events.some((e) => e.type === 'brick-hit' || e.type === 'brick-break'));
  assert.ok(ball.y > brick.y + brick.h, `ball crossed the brick: y=${ball.y}`);
  assert.ok(ballPenetration(world, ball) < 0.5);
  angOk(ball);
  assert.ok(brick.hp < 3);
});

test('random high-speed serves do not tunnel, stick, or break angle limits', () => {
  const wallTop = 210;
  const rowH = 22;
  const rows = 3;
  const wallBottom = wallTop + rows * rowH;

  for (let seed = 1; seed <= 48; seed++) {
    const rand = mulberry32(seed * 997);
    const bricks = [];
    for (let row = 0; row < rows; row++) {
      bricks.push(
        makeBrick({
          x: 0,
          y: wallTop + row * rowH,
          w: FIELD_W,
          h: rowH,
          kind: 'metal',
        }),
      );
    }
    // A few floating blocks in the lower chamber, flush pairs to stress seams.
    const extra = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < extra; i++) {
      const bw = 36 + rand() * 20;
      bricks.push(
        makeBrick({
          x: 20 + rand() * (FIELD_W - bw - 40),
          y: wallBottom + 40 + rand() * 180,
          w: bw,
          h: 18,
          kind: 'metal',
        }),
      );
    }
    const speed = 2800 + rand() * 7200;
    const ang = MIN_ANGLE + rand() * (MAX_ANGLE - MIN_ANGLE);
    const dir = rand() < 0.5 ? -1 : 1;
    const up = rand() < 0.65;
    const ball = {
      x: 30 + rand() * (FIELD_W - 60),
      y: wallBottom + 16 + rand() * 220,
      vx: Math.cos(ang) * speed * dir,
      vy: Math.sin(ang) * speed * (up ? -1 : 1),
      r: BALL_R,
      speed,
      alive: true,
    };
    const paddleW = 70 + rand() * 50;
    const world = createWorld({
      bricks,
      balls: [ball],
      solidBottom: true,
      paddle: {
        x: 40 + rand() * (FIELD_W - 80),
        y: FIELD_H - 34,
        w: paddleW,
        h: 14,
        vx: (rand() - 0.5) * 900,
      },
    });

    let travelled = 0;
    let prevX = ball.x;
    let prevY = ball.y;
    for (let step = 0; step < 240; step++) {
      stepWorld(world, 1 / 120);
      const b = world.balls[0];
      assert.ok(b, `ball removed seed ${seed} step ${step}`);
      angOk(b);
      assert.ok(ballPenetration(world, b) < 0.55, `embedded seed ${seed} step ${step}`);
      assert.ok(
        b.y >= wallBottom + b.r - 0.8,
        `tunneled wall seed ${seed} step ${step} y=${b.y} bottom=${wallBottom}`,
      );
      travelled += Math.hypot(b.x - prevX, b.y - prevY);
      prevX = b.x;
      prevY = b.y;
    }
    assert.ok(travelled > 120, `stuck seed ${seed} moved ${travelled.toFixed(1)}`);
  }
});

test('horizontal seam between flush bricks does not let the ball through', () => {
  const y = 180;
  const h = 24;
  const world = createWorld({
    solidBottom: true,
    bricks: [
      makeBrick({ x: 0, y, w: FIELD_W / 2, h, kind: 'metal' }),
      makeBrick({ x: FIELD_W / 2, y, w: FIELD_W / 2, h, kind: 'metal' }),
    ],
    balls: [
      {
        x: FIELD_W / 2,
        y: y + h + BALL_R + 2,
        vx: 40,
        vy: -8000,
        r: BALL_R,
        speed: 8000,
        alive: true,
      },
    ],
    paddle: { x: 40, y: 610, w: 40, h: 10, vx: 0 },
  });
  for (let i = 0; i < 30; i++) stepWorld(world, 1 / 120);
  const b = world.balls[0];
  assert.ok(b.y >= y + h + b.r - 0.8, `slipped the seam y=${b.y}`);
  angOk(b);
});

test('fast ball does not tunnel through a moving paddle', () => {
  for (let i = 0; i < 24; i++) {
    const rand = mulberry32(1000 + i);
    const paddleW = 100;
    const px = 80 + rand() * 200;
    const pvx = (rand() - 0.5) * 1400;
    const offset = (rand() * 2 - 1) * (paddleW * 0.35);
    const speed = 3500 + rand() * 7000;
    const ang = (30 * Math.PI) / 180 + rand() * ((50 * Math.PI) / 180);
    const world = createWorld({
      bricks: [],
      paddle: { x: px, y: 520, w: paddleW, h: 14, vx: pvx },
      balls: [
        {
          x: px + offset,
          y: 520 - BALL_R - 0.4,
          vx: Math.cos(ang) * speed * (rand() < 0.5 ? -1 : 1),
          vy: Math.sin(ang) * speed,
          r: BALL_R,
          speed,
          alive: true,
        },
      ],
    });
    const events = stepWorld(world, 1 / 120);
    const b = world.balls[0];
    assert.ok(b, `lost ball case ${i}`);
    assert.ok(b.y + b.r <= 520 + 0.9, `tunneled paddle case ${i} y=${b.y}`);
    assert.ok(b.vy < 0, `did not bounce up case ${i} vy=${b.vy}`);
    assert.ok(events.some((e) => e.type === 'paddle'));
    angOk(b);
  }
});

test('paddle hit position sets the bounce side and stays inside the angle window', () => {
  function serve(t, pvx = 0) {
    const paddleW = 110;
    const px = 180;
    const speed = 340;
    const ang = (46 * Math.PI) / 180;
    const world = createWorld({
      bricks: [],
      paddle: { x: px, y: 500, w: paddleW, h: 14, vx: pvx },
      balls: [
        {
          x: px + t * (paddleW / 2),
          y: 500 - BALL_R - 0.15,
          vx: Math.cos(ang) * speed * (t < 0 ? -1 : 1),
          vy: Math.sin(ang) * speed,
          r: BALL_R,
          speed,
          alive: true,
        },
      ],
    });
    stepWorld(world, 1 / 120);
    return world.balls[0];
  }

  const left = serve(-0.75);
  const right = serve(0.75);
  const center = serve(0.02);
  const edge = serve(0.92);
  assert.ok(left.vx < 0, `left vx ${left.vx}`);
  assert.ok(right.vx > 0, `right vx ${right.vx}`);
  for (const b of [left, right, center, edge]) angOk(b);
  const centerAng = angleFromHorizontal(center.vx, center.vy);
  const edgeAng = angleFromHorizontal(edge.vx, edge.vy);
  assert.ok(centerAng > edgeAng + 0.15, `center ${centerAng} edge ${edgeAng}`);

  const influenced = serve(0.02, 700);
  assert.ok(influenced.vx > center.vx, 'paddle velocity should push the ball');
  angOk(influenced);
});

test('level catalogue is hand-built, consistent, and every brick is reachable', () => {
  const errors = validateLevelDefs();
  assert.deepEqual(errors, []);
  assert.ok(LEVELS.length >= 12);

  for (const level of LEVELS) {
    const bricks = createBricks(level, FIELD_W);
    assert.ok(bricks.length > 0, level.name);
    const reached = reachableDestructibles(bricks);
    const missed = bricks.filter((b) => b.kind !== 'metal' && !reached.has(b));
    assert.deepEqual(
      missed.map((b) => `${b.row},${b.col}`),
      [],
      `${level.name} sealed bricks`,
    );
  }
});

function reachableDestructibles(bricks) {
  const r = BALL_R;
  const res = 4;
  const gw = Math.ceil(FIELD_W / res);
  const gh = Math.ceil(FIELD_H / res);
  const reached = new Set();
  const targets = bricks.filter((b) => b.kind !== 'metal');
  let guard = 0;
  while (guard++ < targets.length + 2) {
    const blocking = bricks.filter((b) => b.kind === 'metal' || !reached.has(b));
    const blocked = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const cx = (x + 0.5) * res;
        const cy = (y + 0.5) * res;
        if (cx < r || cx > FIELD_W - r || cy < r) blocked[y * gw + x] = 1;
      }
    }
    for (const b of blocking) {
      const x0 = Math.max(0, Math.floor((b.x - r) / res));
      const y0 = Math.max(0, Math.floor((b.y - r) / res));
      const x1 = Math.min(gw - 1, Math.ceil((b.x + b.w + r) / res));
      const y1 = Math.min(gh - 1, Math.ceil((b.y + b.h + r) / res));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const cx = (x + 0.5) * res;
          const cy = (y + 0.5) * res;
          const nx = Math.max(b.x, Math.min(b.x + b.w, cx));
          const ny = Math.max(b.y, Math.min(b.y + b.h, cy));
          if ((cx - nx) ** 2 + (cy - ny) ** 2 < (r - 0.15) ** 2) blocked[y * gw + x] = 1;
        }
      }
    }
    const seen = new Uint8Array(gw * gh);
    const qx = new Int16Array(gw * gh);
    const qy = new Int16Array(gw * gh);
    let qs = 0;
    let qe = 0;
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= gw || y >= gh) return;
      const i = y * gw + x;
      if (seen[i] || blocked[i]) return;
      seen[i] = 1;
      qx[qe] = x;
      qy[qe] = y;
      qe++;
    };
    for (let x = 0; x < gw; x++) push(x, Math.floor((FIELD_H - 48) / res));
    while (qs < qe) {
      const x = qx[qs];
      const y = qy[qs];
      qs++;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    let added = 0;
    for (const b of targets) {
      if (reached.has(b)) continue;
      if (canTouch(b, seen, gw, gh, r, res)) {
        reached.add(b);
        added++;
      }
    }
    if (!added) break;
  }
  return reached;
}

function canTouch(brick, seen, gw, gh, r, res) {
  const reach = r + res;
  const x0 = Math.max(0, Math.floor((brick.x - reach) / res));
  const y0 = Math.max(0, Math.floor((brick.y - reach) / res));
  const x1 = Math.min(gw - 1, Math.ceil((brick.x + brick.w + reach) / res));
  const y1 = Math.min(gh - 1, Math.ceil((brick.y + brick.h + reach) / res));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!seen[y * gw + x]) continue;
      const cx = (x + 0.5) * res;
      const cy = (y + 0.5) * res;
      const nx = Math.max(brick.x, Math.min(brick.x + brick.w, cx));
      const ny = Math.max(brick.y, Math.min(brick.y + brick.h, cy));
      if ((cx - nx) ** 2 + (cy - ny) ** 2 <= reach * reach) return true;
    }
  }
  return false;
}
