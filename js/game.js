import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  clampVelocity,
  createWorld,
  launchStuck,
  rampSpeed,
  stepWorld,
} from './physics.js?v=1.0.4';
import { LEVELS, createBricks } from './levels.js?v=1.0.4';
import { PALETTES } from './themes.js?v=1.0.4';

const SPEED = { calm: 230, normal: 280, fast: 340 };
const SPEED_CAP = 1.32;
const PADDLE_W = 86;
const PADDLE_WIDE = 136;
const PADDLE_NARROW = 52;

const DROPS = [
  ['wide', 22],
  ['multi', 16],
  ['laser', 15],
  ['slow', 16],
  ['sticky', 14],
  ['life', 8],
  ['shrink', 6],
];

const FX_LABEL = {
  wide: 'Шире',
  laser: 'Лазер',
  slow: 'Тише',
  sticky: 'Клей',
  shrink: 'Уже',
};

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function emptyTimers() {
  return { wide: 0, laser: 0, slow: 0, sticky: 0, shrink: 0 };
}

function weighted(table) {
  let sum = 0;
  for (const row of table) sum += row[1];
  let r = Math.random() * sum;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) return id;
  }
  return table[0][0];
}

export function createGame(settings, audio, progress, onPersist) {
  let mode = 'menu';
  let prevMode = 'menu';
  let run = false;
  let runId = 1;
  let level = 0;
  let score = 0;
  let highScore = progress.highScore || 0;
  let lives = 3;
  let unlocked = Math.max(1, progress.unlocked || 1);
  let completed = Array.from({ length: LEVELS.length }, (_, i) => Boolean(progress.completed?.[i]));
  let world = null;
  let demo = null;
  let particles = [];
  let capsules = [];
  let lasers = [];
  let laserCd = 0;
  let timers = emptyTimers();
  let levelTime = 0;
  let brickHits = 0;
  let rawSpeed = SPEED.normal;
  let ballSpeed = SPEED.normal;
  let combo = 1;
  let comboTimer = 0;
  let shake = 0;
  let time = 0;
  let bannerT = 0;
  let bannerTitle = '';
  let bannerHint = '';
  let toastT = 0;
  let toastText = '';
  let clearLeft = 0;
  let pendingClear = false;
  let serveDir = 1;
  let keyV = 0;
  let aimX = FIELD_W / 2;
  let newRecord = false;
  let chainDepth = 0;

  const input = {
    left: false,
    right: false,
    mouseActive: false,
    mouseX: null,
    touchDx: 0,
  };

  function persist() {
    if (score > highScore) highScore = score;
    onPersist({
      highScore,
      unlocked,
      completed: completed.slice(),
    });
  }

  function baseSpeed() {
    return SPEED[settings.speed] || SPEED.normal;
  }

  function paddleWidth() {
    if (timers.shrink > 0) return PADDLE_NARROW;
    if (timers.wide > 0) return PADDLE_WIDE;
    return PADDLE_W;
  }

  function makeBall(props) {
    return {
      x: FIELD_W / 2,
      y: 400,
      vx: 0,
      vy: 0,
      r: BALL_R,
      speed: ballSpeed,
      stuck: false,
      stuckDx: 0,
      alive: true,
      history: [],
      ...props,
    };
  }

  function spawnStuck() {
    const p = world.paddle;
    world.balls = [
      makeBall({
        x: p.x,
        y: p.y - BALL_R - 1.25,
        stuck: true,
        stuckDx: 0,
        speed: ballSpeed,
      }),
    ];
  }

  function initDemo() {
    demo = createWorld({ w: FIELD_W, h: FIELD_H, solidBottom: true });
    const speed = 290;
    demo.balls = [
      makeBall({
        x: FIELD_W * 0.5,
        y: FIELD_H * 0.62,
        vx: Math.cos(0.9) * speed,
        vy: -Math.sin(0.9) * speed,
        speed,
      }),
    ];
    demo.paddle.y = FIELD_H - 36;
    demo.paddle.w = 90;
  }

  function loadLevel(index) {
    level = index;
    world = createWorld({ w: FIELD_W, h: FIELD_H });
    world.bricks = createBricks(LEVELS[index], FIELD_W);
    levelTime = 0;
    brickHits = 0;
    combo = 1;
    comboTimer = 0;
    timers = emptyTimers();
    capsules = [];
    lasers = [];
    laserCd = 0.35;
    pendingClear = false;
    particles = [];
    rawSpeed = baseSpeed();
    ballSpeed = rawSpeed;
    world.paddle.w = PADDLE_W;
    world.paddle.h = 14;
    world.paddle.x = FIELD_W / 2;
    world.paddle.y = FIELD_H - 32;
    world.paddle.vx = 0;
    aimX = FIELD_W / 2;
    keyV = 0;
    spawnStuck();
    bannerTitle = `Уровень ${index + 1} · ${LEVELS[index].name}`;
    bannerHint = LEVELS[index].hint;
    bannerT = 1;
    mode = 'playing';
    run = true;
  }

  function startNewGame() {
    score = 0;
    lives = 3;
    newRecord = false;
    runId += 1;
    loadLevel(0);
  }

  function startAt(index) {
    if (index < 0 || index >= LEVELS.length || index >= unlocked) return;
    score = 0;
    lives = 3;
    newRecord = false;
    runId += 1;
    loadLevel(index);
  }

  function toMenu() {
    mode = 'menu';
    run = false;
    particles = [];
    capsules = [];
    lasers = [];
    input.left = false;
    input.right = false;
    input.mouseActive = false;
  }

  function openSettings() {
    if (mode !== 'settings') prevMode = mode;
    mode = 'settings';
  }

  function closeSettings() {
    mode = prevMode && prevMode !== 'settings' ? prevMode : 'menu';
  }

  function togglePause() {
    if (mode === 'playing' || mode === 'levelclear') {
      prevMode = mode;
      mode = 'paused';
      input.left = false;
      input.right = false;
      return;
    }
    if (mode === 'paused') {
      mode = prevMode === 'levelclear' ? 'levelclear' : 'playing';
    }
  }

  function hide() {
    input.left = false;
    input.right = false;
    if (mode === 'playing' || mode === 'levelclear') {
      prevMode = mode;
      mode = 'paused';
    }
  }

  function launch() {
    if (mode !== 'playing' || !world) return;
    let launched = false;
    for (const ball of world.balls) {
      if (!ball.stuck) continue;
      ball.speed = ballSpeed;
      launchStuck(world, ball, serveDir);
      serveDir *= -1;
      ball.history = [];
      launched = true;
    }
    if (launched) audio.play('launch');
  }

  function toast(text) {
    toastText = text;
    toastT = 1;
  }

  function vibrate(ms) {
    if (!settings.vibrate || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(ms);
    } catch {
      /* unsupported */
    }
  }

  function burst(brick, count) {
    const pal = PALETTES[settings.theme] || PALETTES.neon;
    const color = pal[brick.color] || '#fff';
    const x = brick.x + brick.w / 2;
    const y = brick.y + brick.h / 2;
    const soft = settings.theme === 'minimal';
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (soft ? 40 : 90) + Math.random() * (soft ? 70 : 160);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: soft ? 0.45 + Math.random() * 0.35 : 0.28 + Math.random() * 0.32,
        max: 0.7,
        color,
        size: soft ? 2.2 + Math.random() * 2.4 : 1.4 + Math.random() * 1.8,
        g: soft ? 40 : 280,
      });
    }
    if (particles.length > 280) particles.splice(0, particles.length - 280);
  }

  function comboUp() {
    combo = Math.min(8, combo + 1);
    comboTimer = 1.05;
  }

  function maybeDrop(brick) {
    if (Math.random() > 0.34) return;
    capsules.push({
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      w: 26,
      h: 14,
      vy: 150,
      type: weighted(DROPS),
    });
  }

  function onDestroy(brick, fromChain, depth) {
    brickHits += 1;
    score += brick.points * combo;
    comboUp();
    burst(brick, fromChain ? 7 : brick.kind === 'explosive' ? 16 : 12);
    shake = Math.min(1, shake + (brick.kind === 'explosive' ? 0.55 : 0.22));
    vibrate(brick.kind === 'explosive' ? 16 : 8);
    if (!fromChain) maybeDrop(brick);
    if (brick.kind === 'explosive' && depth < 6) {
      audio.play('explode');
      chainFrom(brick, depth);
    } else {
      audio.play('break');
    }
    if (score > highScore) {
      highScore = score;
      persist();
    }
  }

  function chainFrom(origin, depth) {
    chainDepth += 1;
    if (chainDepth > 80) return;
    for (const other of world.bricks) {
      if (other === origin || !other.alive || other.kind === 'metal') continue;
      if (Math.abs(other.row - origin.row) > 1 || Math.abs(other.col - origin.col) > 1) continue;
      damageExternal(other, depth + 1);
    }
  }

  function damageExternal(brick, depth) {
    if (!brick.alive || brick.kind === 'metal') return;
    brick.hp -= 1;
    brick.flash = 1;
    if (brick.hp > 0) {
      score += 30;
      return;
    }
    brick.alive = false;
    onDestroy(brick, true, depth);
  }

  function splitBalls() {
    const moving = world.balls.filter((b) => !b.stuck);
    const source = moving[0] || world.balls[0];
    if (!source) return;
    if (source.stuck) {
      source.speed = ballSpeed;
      launchStuck(world, source, serveDir);
    }
    for (let i = 0; i < 2 && world.balls.length < 6; i++) {
      const rot = i === 0 ? 0.46 : -0.46;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const v = clampVelocity(source.vx * c - source.vy * s, source.vx * s + source.vy * c, source.speed);
      world.balls.push(
        makeBall({
          x: source.x,
          y: source.y,
          vx: v.vx,
          vy: v.vy,
          speed: source.speed,
        }),
      );
    }
  }

  function applyPower(type) {
    if (type === 'wide') {
      timers.wide = 12;
      timers.shrink = 0;
      toast('Широкая ракетка');
    } else if (type === 'shrink') {
      timers.shrink = 10;
      timers.wide = 0;
      toast('Ракетка сжимается');
    } else if (type === 'laser') {
      timers.laser = 8;
      laserCd = 0.05;
      toast('Лазер');
    } else if (type === 'slow') {
      timers.slow = 10;
      toast('Медленный мяч');
    } else if (type === 'sticky') {
      timers.sticky = 12;
      toast('Липкая ракетка');
    } else if (type === 'life') {
      lives = Math.min(7, lives + 1);
      toast('Дополнительная жизнь');
      audio.play('life');
    } else if (type === 'multi') {
      splitBalls();
      toast('Мультимяч');
    }
    if (type !== 'life') audio.play(type === 'shrink' ? 'bad' : 'power');
    vibrate(type === 'shrink' ? 28 : 12);
  }

  function catchCapsule(cap) {
    const p = world.paddle;
    return (
      Math.abs(cap.x - p.x) < p.w / 2 + cap.w / 2 &&
      cap.y + cap.h / 2 >= p.y &&
      cap.y - cap.h / 2 <= p.y + p.h + 6
    );
  }

  function stepCapsules(dt) {
    for (const cap of capsules) {
      cap.y += cap.vy * dt;
      if (catchCapsule(cap)) {
        cap.dead = true;
        applyPower(cap.type);
      } else if (cap.y > FIELD_H + 20) cap.dead = true;
    }
    capsules = capsules.filter((c) => !c.dead);
  }

  function stepLasers(dt) {
    if (timers.laser > 0) {
      laserCd -= dt;
      if (laserCd <= 0) {
        laserCd = 0.28;
        const p = world.paddle;
        lasers.push({ x: p.x - p.w * 0.28, y: p.y, vy: -980 });
        lasers.push({ x: p.x + p.w * 0.28, y: p.y, vy: -980 });
        audio.play('laser');
      }
    }
    for (const bolt of lasers) {
      const y0 = bolt.y;
      const y1 = bolt.y + bolt.vy * dt;
      bolt.y = y1;
      let hit = null;
      for (const brick of world.bricks) {
        if (!brick.alive) continue;
        if (bolt.x < brick.x || bolt.x > brick.x + brick.w) continue;
        const low = Math.min(y0, y1);
        const high = Math.max(y0, y1);
        if (brick.y + brick.h < low || brick.y > high) continue;
        if (!hit || brick.y > hit.y) hit = brick;
      }
      if (hit) {
        bolt.dead = true;
        if (hit.kind === 'metal') {
          hit.flash = 0.45;
          audio.play('metal');
        } else {
          damageExternal(hit, 0);
        }
      } else if (bolt.y < -8) bolt.dead = true;
    }
    lasers = lasers.filter((b) => !b.dead);
  }

  function hasDestructibles() {
    return world.bricks.some((b) => b.alive && b.kind !== 'metal');
  }

  function checkClear() {
    if (pendingClear || mode !== 'playing' || !world) return;
    if (hasDestructibles()) return;
    pendingClear = true;
    mode = 'levelclear';
    clearLeft = 0.65;
    audio.play('clear');
    shake = Math.min(1, shake + 0.35);
  }

  function advance() {
    completed[level] = true;
    unlocked = Math.max(unlocked, Math.min(LEVELS.length, level + 2));
    persist();
    if (level + 1 >= LEVELS.length) {
      mode = 'win';
      newRecord = score >= highScore;
      if (score > highScore) highScore = score;
      persist();
      return;
    }
    loadLevel(level + 1);
  }

  function loseLife() {
    lives -= 1;
    combo = 1;
    shake = Math.min(1, shake + 0.8);
    vibrate(32);
    lasers = [];
    audio.play('die');
    if (lives <= 0) {
      mode = 'gameover';
      newRecord = score > 0 && score >= highScore;
      if (score > highScore) highScore = score;
      persist();
      return;
    }
    spawnStuck();
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'brick-break') onDestroy(e.brick, false, 0);
      else if (e.type === 'brick-hit') {
        e.brick.flash = 1;
        score += 40;
        comboUp();
        audio.play('hit');
        burst(e.brick, 5);
        shake = Math.min(1, shake + 0.08);
      } else if (e.type === 'metal') {
        e.brick.flash = 0.55;
        audio.play('metal');
        shake = Math.min(1, shake + 0.12);
      } else if (e.type === 'paddle' || e.type === 'paddle-stick') audio.play('paddle');
      else if (e.type === 'wall') audio.play('wall');
    }
    if (mode === 'playing' && world.balls.length === 0) {
      if (!hasDestructibles()) checkClear();
      else loseLife();
    }
  }

  function movePaddle(dt) {
    const sens = clamp(Number(settings.sensitivity) || 1, 0.55, 1.7);
    const p = world.paddle;
    const accel = 2700 * sens;
    const maxV = 860 * sens;
    if (input.left && !input.right) keyV -= accel * dt;
    else if (input.right && !input.left) keyV += accel * dt;
    else keyV *= Math.exp(-12 * dt);
    if (Math.abs(keyV) < 6) keyV = 0;
    keyV = clamp(keyV, -maxV, maxV);
    if (input.mouseActive && Number.isFinite(input.mouseX)) {
      aimX = input.mouseX;
      input.mouseActive = false;
    }
    aimX += input.touchDx * sens;
    input.touchDx = 0;
    aimX += keyV * dt;
    const half = p.w / 2;
    aimX = clamp(aimX, half + 1, FIELD_W - half - 1);
    p.vx = (aimX - p.x) / dt;
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (particles.some((p) => p.life <= 0)) particles = particles.filter((p) => p.life > 0);
  }

  function recordHistory() {
    for (const ball of world.balls) {
      if (!ball.history) ball.history = [];
      ball.history.push({ x: ball.x, y: ball.y });
      if (ball.history.length > 14) ball.history.shift();
    }
  }

  function stepDemo(dt) {
    if (!demo) initDemo();
    const target = FIELD_W / 2 + Math.sin(time * 0.85) * 110;
    demo.paddle.vx = (target - demo.paddle.x) / dt;
    stepWorld(demo, dt);
    const ball = demo.balls[0];
    if (ball) {
      if (!ball.history) ball.history = [];
      ball.history.push({ x: ball.x, y: ball.y });
      if (ball.history.length > 12) ball.history.shift();
    }
    if (!demo.balls.length) initDemo();
  }

  function step(dt) {
    if (!(dt > 0)) return;
    time += dt;
    if (shake > 0) {
      shake *= Math.exp(-3.4 * dt);
      if (shake < 0.01) shake = 0;
    }
    updateParticles(dt);
    const showDemo = !run && (mode === 'menu' || mode === 'levels' || mode === 'settings');
    if (showDemo) {
      stepDemo(dt);
      return;
    }
    if (bannerT > 0) bannerT -= dt;
    if (toastT > 0) toastT -= dt;
    if (mode === 'levelclear') {
      clearLeft -= dt;
      if (clearLeft <= 0) advance();
      return;
    }
    if (mode !== 'playing' || !world) return;

    comboTimer -= dt;
    if (comboTimer <= 0) combo = 1;
    for (const key of Object.keys(timers)) timers[key] = Math.max(0, timers[key] - dt);
    levelTime += dt;
    const base = baseSpeed();
    rawSpeed = rampSpeed(base, levelTime, brickHits, base * SPEED_CAP);
    ballSpeed = rawSpeed * (timers.slow > 0 ? 0.62 : 1);
    world.paddle.w = paddleWidth();
    world.sticky = timers.sticky > 0;
    movePaddle(dt);
    for (const ball of world.balls) ball.speed = ballSpeed;
    chainDepth = 0;
    const events = stepWorld(world, dt);
    handleEvents(events);
    if (mode !== 'playing') return;
    stepCapsules(dt);
    stepLasers(dt);
    recordHistory();
    for (const brick of world.bricks) {
      if (brick.flash > 0) brick.flash = Math.max(0, brick.flash - dt * 5);
    }
    checkClear();
  }

  function completeLevel() {
    if (!run || !world) return;
    for (const brick of world.bricks) {
      if (brick.kind !== 'metal') {
        brick.alive = false;
        brick.hp = 0;
      }
    }
    if (mode !== 'playing') mode = 'playing';
    pendingClear = false;
    checkClear();
  }

  function activeFx() {
    const list = [];
    for (const key of Object.keys(FX_LABEL)) {
      if (timers[key] > 0) list.push({ id: key, label: FX_LABEL[key], t: timers[key] });
    }
    return list;
  }

  function viewWorld() {
    if (!run) return demo;
    return world || demo;
  }

  function snapshot() {
    return {
      mode,
      level,
      levelCount: LEVELS.length,
      levelName: LEVELS[level] ? LEVELS[level].name : '',
      levels: LEVELS.map((entry, i) => ({
        name: entry.name,
        unlocked: i < unlocked,
        done: Boolean(completed[i]),
      })),
      score,
      highScore,
      lives,
      unlocked,
      runId,
      run,
      newRecord,
      banner: bannerT > 0 ? bannerTitle : '',
      hint: bannerT > 0.2 ? bannerHint : '',
      toast: toastT > 0 ? toastText : '',
      combo: combo > 1 ? combo : 0,
      fx: activeFx(),
      clearLeft: mode === 'levelclear' ? clearLeft : 0,
    };
  }

  initDemo();

  return {
    settings,
    input,
    get mode() {
      return mode;
    },
    set mode(value) {
      mode = value;
    },
    get shake() {
      return shake;
    },
    get time() {
      return time;
    },
    get levelTime() {
      return levelTime;
    },
    get particles() {
      return particles;
    },
    get capsules() {
      return capsules;
    },
    get lasers() {
      return lasers;
    },
    get run() {
      return run;
    },
    viewWorld,
    snapshot,
    step,
    launch,
    startNewGame,
    startAt,
    toMenu,
    openSettings,
    closeSettings,
    togglePause,
    hide,
    completeLevel,
    announce: toast,
    LEVELS,
  };
}
