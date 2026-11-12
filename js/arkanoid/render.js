import { FIELD_H, FIELD_W } from './physics.js?v=2.1.0';
import { PALETTES } from './themes.js?v=2.1.0';

const CAPSULE = {
  wide: { glyph: '↔', fill: '#2ee9ff' },
  multi: { glyph: '×3', fill: '#ff8a3d' },
  laser: { glyph: 'Л', fill: '#ff4d6d' },
  slow: { glyph: 'М', fill: '#3dffb0' },
  sticky: { glyph: 'К', fill: '#ffe14a' },
  life: { glyph: '+1', fill: '#ff7ad9' },
  shrink: { glyph: '–', fill: '#9aa3b8' },
};

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  const sprites = new Map();
  const ballSprites = new Map();
  let builtFor = '';
  let stars = null;
  let nebula = null;
  let crt = null;
  let layout = {
    dpr: 1,
    cssW: 1,
    cssH: 1,
    scale: 1,
    ox: 0,
    oy: 0,
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buildStars() {
    stars = [];
    let s = 42;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 110; i++) {
      stars.push({ x: rnd(), y: rnd(), z: rnd(), r: 0.5 + rnd() * 1.5 });
    }
  }

  function buildNebula() {
    nebula = document.createElement('canvas');
    nebula.width = 480;
    nebula.height = 800;
    const g = nebula.getContext('2d');
    g.fillStyle = '#070b16';
    g.fillRect(0, 0, 480, 800);
    const blobs = [
      ['#24398a', 90, 150, 230],
      ['#6a2458', 380, 260, 210],
      ['#0f4f58', 200, 560, 260],
      ['#1a2a55', 420, 680, 180],
    ];
    for (const [color, x, y, rad] of blobs) {
      const grd = g.createRadialGradient(x, y, 8, x, y, rad);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 480, 800);
    }
  }

  function buildCrt() {
    crt = document.createElement('canvas');
    crt.width = 4;
    crt.height = 4;
    const g = crt.getContext('2d');
    g.clearRect(0, 0, 4, 4);
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(0, 0, 4, 1);
    g.fillStyle = 'rgba(255,255,255,0.025)';
    g.fillRect(0, 2, 4, 1);
  }

  function brickSprite(theme, colorIndex, w, h) {
    const key = `${theme}:${colorIndex}:${w.toFixed(2)}:${h.toFixed(2)}`;
    const cached = sprites.get(key);
    if (cached) return cached;
    const pal = PALETTES[theme] || PALETTES.neon;
    const color = pal[colorIndex] || pal[0];
    const pad = theme === 'neon' ? 10 : theme === 'minimal' ? 8 : 2;
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * scale);
    c.height = Math.ceil((h + pad * 2) * scale);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(pad, pad);
    if (theme === 'neon') {
      g.shadowColor = color;
      g.shadowBlur = 12;
      g.fillStyle = color;
      roundRect(g, 0, 0, w, h, 3);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.38)';
      roundRect(g, 1.2, 1.2, w - 2.4, h * 0.42, 2);
      g.fill();
    } else if (theme === 'classic') {
      g.fillStyle = '#140c18';
      g.fillRect(-1, -1, w + 2, h + 2);
      g.fillStyle = shade(color, -35);
      g.fillRect(0, 0, w, h);
      g.fillStyle = shade(color, 50);
      g.fillRect(1, 1, w - 2, 3);
      g.fillRect(1, 1, 3, h - 2);
      g.fillStyle = color;
      g.fillRect(3, 3, w - 6, h - 6);
    } else if (theme === 'space') {
      const alien = colorIndex === 5 || colorIndex === 6;
      g.fillStyle = shade(color, -20);
      g.beginPath();
      if (alien) {
        roundRect(g, 1, 2, w - 2, h - 3, 5);
        g.fill();
        g.fillStyle = '#eaffff';
        g.beginPath();
        g.arc(w * 0.35, h * 0.48, 2.1, 0, Math.PI * 2);
        g.arc(w * 0.65, h * 0.48, 2.1, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#102028';
        g.beginPath();
        g.arc(w * 0.35, h * 0.48, 0.9, 0, Math.PI * 2);
        g.arc(w * 0.65, h * 0.48, 0.9, 0, Math.PI * 2);
        g.fill();
      } else {
        g.ellipse(w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.4, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.22)';
        const cx = 3 + hash(colorIndex + w) * (w - 8);
        g.beginPath();
        g.arc(cx, h * 0.45, 2.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.ellipse(w * 0.32, h * 0.32, w * 0.16, h * 0.18, -0.4, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.shadowColor = 'rgba(40, 36, 48, 0.16)';
      g.shadowBlur = 6;
      g.shadowOffsetY = 2;
      g.fillStyle = color;
      roundRect(g, 0, 0, w, h, 5);
      g.fill();
    }
    const sprite = { canvas: c, pad };
    sprites.set(key, sprite);
    return sprite;
  }

  function ballSprite(theme) {
    if (ballSprites.has(theme)) return ballSprites.get(theme);
    const c = document.createElement('canvas');
    const size = theme === 'neon' || theme === 'space' ? 64 : 32;
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const mid = size / 2;
    if (theme === 'neon' || theme === 'space') {
      const grd = g.createRadialGradient(mid, mid, 2, mid, mid, mid);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.35, theme === 'space' ? 'rgba(255,196,92,0.85)' : 'rgba(46,233,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(mid, mid, mid - 1, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = theme === 'classic' ? '#ffe14a' : '#2a2a2e';
      g.beginPath();
      g.arc(mid, mid, mid * 0.42, 0, Math.PI * 2);
      g.fill();
    }
    ballSprites.set(theme, c);
    return c;
  }

  let lock = null;

  function reservedHudHeight(hudEl) {
    const measured = hudEl.getBoundingClientRect().height;
    if (measured > 0) return measured;
    return 56;
  }

  function placeField(cssW, cssH, hudH, dpr) {
    let sab = 0;
    const raw = getComputedStyle(document.body).getPropertyValue('--sab').trim();
    if (raw.endsWith('px')) sab = Number.parseFloat(raw) || 0;
    const availH = Math.max(80, cssH - hudH - sab);
    const scale = Math.min(cssW / FIELD_W, availH / FIELD_H);
    const ox = (cssW - FIELD_W * scale) / 2;
    const oy = hudH + Math.max(0, (availH - FIELD_H * scale) / 2);
    return {
      dpr,
      cssW,
      cssH,
      scale,
      ox,
      oy,
      hudH,
      centerX: ox + (FIELD_W * scale) / 2,
      centerY: oy + (FIELD_H * scale) / 2,
    };
  }

  function resize(hudEl) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const hudVisible = Boolean(hudEl && !hudEl.hidden);
    const hudH = hudVisible ? reservedHudHeight(hudEl) : 0;
    const next = placeField(cssW, cssH, hudH, dpr);
    const usable = cssW >= 200 && cssH >= 200;
    if (lock && usable && lock.hudVisible === hudVisible) {
      const dw = Math.abs(cssW - lock.cssW);
      const dh = Math.abs(cssH - lock.cssH);
      // Score, combo and the mobile URL bar must not refit the bricks.
      // A real rotation or a large window resize still does.
      if (dw <= 48 && dh <= 120) {
        layout = { ...lock.placed, dpr, cssW, cssH };
        return layout;
      }
    }
    if (usable) lock = { cssW, cssH, hudVisible, placed: next };
    layout = next;
    return layout;
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - layout.ox) / layout.scale,
      y: (clientY - rect.top - layout.oy) / layout.scale,
    };
  }

  function paintBackground(theme, game) {
    const { cssW, cssH } = layout;
    if (theme === 'neon') {
      const g = ctx.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, '#1a0a24');
      g.addColorStop(0.45, '#070814');
      g.addColorStop(1, '#160814');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = 'rgba(46, 233, 255, 0.07)';
      ctx.lineWidth = 1;
      const gap = 36;
      ctx.beginPath();
      for (let x = 0; x <= cssW; x += gap) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, cssH);
      }
      for (let y = 0; y <= cssH; y += gap) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(cssW, y + 0.5);
      }
      ctx.stroke();
    } else if (theme === 'classic') {
      ctx.fillStyle = '#100c22';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = 0; y < cssH; y += 8) ctx.fillRect(0, y, cssW, 1);
    } else if (theme === 'space') {
      if (!nebula) buildNebula();
      if (!stars) buildStars();
      ctx.drawImage(nebula, 0, 0, cssW, cssH);
      const paddle = game.viewWorld()?.paddle;
      const par = paddle ? (paddle.x / FIELD_W - 0.5) : 0;
      ctx.fillStyle = '#f4f7ff';
      for (const star of stars) {
        const drift = game.time * (0.004 + star.z * 0.018);
        let x = (star.x + par * 0.12 * star.z + drift * 0.4) % 1;
        let y = (star.y + drift) % 1;
        if (x < 0) x += 1;
        if (y < 0) y += 1;
        ctx.globalAlpha = 0.3 + star.z * 0.7;
        const s = star.r * (0.8 + star.z);
        ctx.fillRect(x * cssW, y * cssH, s, s);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#f3efe7';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = 'rgba(80, 70, 60, 0.05)';
      for (let y = 18; y < cssH; y += 22) {
        for (let x = 14; x < cssW; x += 22) ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  function drawBricks(theme, world, levelTime) {
    for (const brick of world.bricks) {
      if (!brick.alive) continue;
      const fade = Math.min(1, Math.max(0, (levelTime - brick.row * 0.012) / 0.16));
      const sprite = brickSprite(theme, brick.color, brick.w, brick.h);
      ctx.globalAlpha = fade;
      ctx.drawImage(
        sprite.canvas,
        brick.x - sprite.pad,
        brick.y - sprite.pad,
        brick.w + sprite.pad * 2,
        brick.h + sprite.pad * 2,
      );
      if (brick.kind === 'metal') {
        ctx.strokeStyle = theme === 'minimal' ? 'rgba(60,60,70,0.35)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 1.5, brick.y + 1.5, brick.w - 3, brick.h - 3);
        ctx.fillStyle = theme === 'minimal' ? 'rgba(60,60,70,0.45)' : 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(brick.x + 4, brick.y + 4, 1.1, 0, Math.PI * 2);
        ctx.arc(brick.x + brick.w - 4, brick.y + 4, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (brick.kind === 'multi' && brick.hp < brick.maxHp) {
        ctx.strokeStyle = theme === 'minimal' ? 'rgba(40,30,40,0.45)' : 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(brick.x + 3, brick.y + 3);
        ctx.lineTo(brick.x + brick.w * 0.62, brick.y + brick.h - 3);
        if (brick.maxHp - brick.hp > 1) {
          ctx.moveTo(brick.x + brick.w - 3, brick.y + 4);
          ctx.lineTo(brick.x + brick.w * 0.35, brick.y + brick.h * 0.75);
        }
        ctx.stroke();
      }
      if (brick.kind === 'explosive') {
        ctx.fillStyle = theme === 'minimal' ? 'rgba(80,40,50,0.8)' : 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        const pulse = 2 + Math.sin(levelTime * 8 + brick.id) * 0.45;
        ctx.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      if (brick.flash > 0) {
        ctx.globalAlpha = brick.flash * (theme === 'minimal' ? 0.35 : 0.55);
        ctx.fillStyle = '#fff';
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPaddle(theme, paddle) {
    const x = paddle.x - paddle.w / 2;
    const y = paddle.y;
    const w = paddle.w;
    const h = paddle.h;
    if (theme === 'space') {
      ctx.fillStyle = '#d7e7ff';
      ctx.beginPath();
      ctx.ellipse(paddle.x, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8fd8ff';
      ctx.beginPath();
      ctx.ellipse(paddle.x, y + h / 2 - 1, w * 0.16, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(paddle.x - w * 0.22, y + h - 2, 5, 3);
      ctx.fillRect(paddle.x + w * 0.12, y + h - 2, 5, 3);
      return;
    }
    if (theme === 'classic') {
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#d23a4a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ffd0d6';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(paddle.x - 6, y + 4, 12, 4);
      return;
    }
    if (theme === 'minimal') {
      ctx.fillStyle = '#2c2a32';
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, '#2ee9ff');
    g.addColorStop(1, '#ff2bd6');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(ctx, x + 3, y + 2, w - 6, 3, 2);
    ctx.fill();
  }

  function drawBalls(theme, balls) {
    for (const ball of balls) {
      const trail = ball.history || [];
      if ((theme === 'neon' || theme === 'space' || theme === 'minimal') && trail.length) {
        for (let i = 0; i < trail.length; i++) {
          const t = trail[i];
          const a = ((i + 1) / trail.length) * (theme === 'minimal' ? 0.18 : 0.35);
          ctx.globalAlpha = a;
          ctx.fillStyle = theme === 'space' ? '#ffd27a' : theme === 'minimal' ? '#2c2a32' : '#7af6ff';
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.r * (theme === 'minimal' ? 0.7 : 0.85), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (theme === 'neon' || theme === 'space') {
        const sprite = ballSprite(theme);
        const s = ball.r * 5.2;
        ctx.drawImage(sprite, ball.x - s / 2, ball.y - s / 2, s, s);
      } else if (theme === 'classic') {
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff6c2';
        ctx.fillRect(ball.x - 2, ball.y - 3, 3, 3);
      } else {
        ctx.fillStyle = 'rgba(40,36,48,0.12)';
        ctx.beginPath();
        ctx.ellipse(ball.x, ball.y + ball.r + 2, ball.r * 0.8, ball.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2c2a32';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCapsules(list) {
    for (const cap of list) {
      const look = CAPSULE[cap.type] || CAPSULE.wide;
      ctx.fillStyle = look.fill;
      roundRect(ctx, cap.x - cap.w / 2, cap.y - cap.h / 2, cap.w, cap.h, 7);
      ctx.fill();
      ctx.fillStyle = '#16141c';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(look.glyph, cap.x, cap.y + 0.5);
    }
  }

  function drawLasers(list, theme) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme === 'minimal' ? '#e11d48' : '#ff5d7a';
    ctx.beginPath();
    for (const bolt of list) {
      ctx.moveTo(bolt.x, bolt.y);
      ctx.lineTo(bolt.x, bolt.y + 18);
    }
    ctx.stroke();
  }

  function drawParticles(list) {
    for (const p of list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(game) {
    const theme = game.settings.theme || 'neon';
    if (builtFor !== theme) {
      sprites.clear();
      ballSprites.clear();
      builtFor = theme;
    }
    const world = game.viewWorld();
    ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
    paintBackground(theme, game);
    const amp = reduced ? 0 : theme === 'minimal' ? game.shake * 2.2 : game.shake * 5;
    const sx = amp ? Math.sin(game.time * 48) * amp : 0;
    const sy = amp ? Math.cos(game.time * 37) * amp * 0.65 : 0;
    ctx.save();
    ctx.translate(layout.ox + sx, layout.oy + sy);
    ctx.scale(layout.scale, layout.scale);
    if (world) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, FIELD_W, FIELD_H);
      ctx.clip();
      drawBricks(theme, world, game.run ? game.levelTime : 2);
      if (game.run) {
        drawCapsules(game.capsules);
        drawLasers(game.lasers, theme);
      }
      if (world.paddle) drawPaddle(theme, world.paddle);
      drawBalls(theme, world.balls);
      if (game.run) drawParticles(game.particles);
      ctx.restore();
      ctx.strokeStyle = theme === 'minimal' ? 'rgba(40,36,48,0.18)' : 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, FIELD_W - 2, FIELD_H - 2);
    }
    ctx.restore();
    if (theme === 'classic' && crt) {
      ctx.save();
      ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
      ctx.fillStyle = ctx.createPattern(crt, 'repeat');
      ctx.fillRect(0, 0, layout.cssW, layout.cssH);
      const vig = ctx.createRadialGradient(
        layout.cssW / 2,
        layout.cssH / 2,
        layout.cssH * 0.3,
        layout.cssW / 2,
        layout.cssH / 2,
        layout.cssH * 0.72,
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, layout.cssW, layout.cssH);
      ctx.restore();
    } else if (theme === 'neon' || theme === 'space') {
      ctx.save();
      ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
      const vig = ctx.createRadialGradient(
        layout.cssW / 2,
        layout.cssH / 2,
        layout.cssH * 0.35,
        layout.cssW / 2,
        layout.cssH / 2,
        layout.cssH * 0.78,
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, layout.cssW, layout.cssH);
      ctx.restore();
    }
    ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  }

  function brickRects(bricks) {
    if (!bricks) return [];
    const { ox, oy, scale } = layout;
    return bricks
      .filter((brick) => brick.alive)
      .map((brick) => ({
        id: brick.id,
        x: ox + brick.x * scale,
        y: oy + brick.y * scale,
        w: brick.w * scale,
        h: brick.h * scale,
      }));
  }

  buildCrt();
  return { draw, resize, toField, getLayout: () => layout, brickRects };
}
