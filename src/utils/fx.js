/* Particle & celebration effects (DOM + Web Animations API).
 * All pieces render into #fx-layer (fixed, pointer-events: none). */

const FX_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#ffffff'];

function fxLayer() {
  return document.getElementById('fx-layer');
}

function px(el, name, val) { el.style[name] = val + 'px'; }

/* Radial star burst at client coords (x, y) */
export function burst(x, y, { count = 14, colors = FX_COLORS, size = [8, 18], dist = 110 } = {}) {
  const layer = fxLayer();
  if (!layer) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'fx-particle';
    const s = size[0] + Math.random() * (size[1] - size[0]);
    px(p, 'width', s); px(p, 'height', s);
    p.style.background = colors[(Math.random() * colors.length) | 0];
    p.style.borderRadius = Math.random() > 0.4 ? '50%' : '2px';
    px(p, 'left', x); px(p, 'top', y);
    layer.appendChild(p);
    const a = Math.random() * Math.PI * 2;
    const d = dist * (0.4 + Math.random() * 0.8);
    const tx = Math.cos(a) * d;
    const ty = Math.sin(a) * d;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 130}px)) scale(0.35) rotate(${(Math.random() * 360 - 180) | 0}deg)`, opacity: 0 }
    ], { duration: 620 + Math.random() * 480, easing: 'cubic-bezier(.17,.67,.4,1)' }).onfinish = () => p.remove();
  }
}

/* Full-screen falling confetti */
export function confetti({ count = 90 } = {}) {
  const layer = fxLayer();
  if (!layer) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'fx-particle';
    const s = 8 + Math.random() * 10;
    px(p, 'width', s); px(p, 'height', s * 1.5);
    p.style.background = FX_COLORS[(Math.random() * FX_COLORS.length) | 0];
    p.style.borderRadius = '2px';
    px(p, 'left', Math.random() * W);
    px(p, 'top', -30);
    layer.appendChild(p);
    p.animate([
      { transform: 'translate(-50%,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.random() * 180 - 90}px), ${H + 90}px) rotate(${(Math.random() * 720 - 360) | 0}deg)`, opacity: 1 }
    ], {
      duration: 1700 + Math.random() * 1500,
      delay: Math.random() * 500,
      easing: 'cubic-bezier(.3,.4,.6,1)'
    }).onfinish = () => p.remove();
  }
}

/* Floating emoji (e.g. a star) that rises and fades */
export function floatUp(x, y, emoji = '⭐') {
  const layer = fxLayer();
  if (!layer) return;
  const s = document.createElement('div');
  s.className = 'fx-emoji';
  s.textContent = emoji;
  px(s, 'left', x); px(s, 'top', y);
  layer.appendChild(s);
  s.animate([
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%,-150%) scale(1.35)', opacity: 1, offset: 0.4 },
    { transform: 'translate(-50%,-280%) scale(1)', opacity: 0 }
  ], { duration: 1150, easing: 'ease-out' }).onfinish = () => s.remove();
}

/* Star burst + floating star at the center of an element */
export function rewardAt(el, { count = 16, emoji = '⭐' } = {}) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  burst(cx, cy, { count });
  floatUp(cx, cy - 10, emoji);
}
