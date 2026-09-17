import './style.css';
import { sound } from './audio/SoundManager.js';
import { storage } from './utils/storage.js';
import HubScene from './scenes/HubScene.js';
import SnapBuilderScene from './scenes/SnapBuilderScene.js';
import FeedMonsterScene from './scenes/FeedMonsterScene.js';
import TowerJumpScene from './scenes/TowerJumpScene.js';
import TracePopScene from './scenes/TracePopScene.js';
import InstrumentsScene from './scenes/InstrumentsScene.js';
import MatchScene from './scenes/MatchScene.js';
import PuzzlePartsScene from './scenes/PuzzlePartsScene.js';
import ConnectDotsScene from './scenes/ConnectDotsScene.js';
import SortItScene from './scenes/SortItScene.js';
import MemoryPairsScene from './scenes/MemoryPairsScene.js';

const SCENES = {
  hub: HubScene,
  snap: SnapBuilderScene,
  feed: FeedMonsterScene,
  tower: TowerJumpScene,
  trace: TracePopScene,
  instruments: InstrumentsScene,
  match: MatchScene,
  parts: PuzzlePartsScene,
  dots: ConnectDotsScene,
  sort: SortItScene,
  memory: MemoryPairsScene
};

const stage = document.getElementById('stage');
const topbar = document.getElementById('topbar');
let current = null;
let currentId = null;
let unsubStars = null;
let unsubMuted = null;

const ctx = {
  sound,
  storage,
  stage,
  go: (id) => goTo(id)
};

/* ---------- Full screen ----------
 * iPad Safari does expose the Fullscreen API (iPhone Safari and Chrome on iOS
 * do not - same engine, but Apple only wires it up in Safari proper). Where it
 * is missing, the only real full screen on iOS is Add to Home Screen, so the
 * button explains that rather than doing nothing. */
const FS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FS_EXIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches;
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

let hintTimer = null;
function showFullscreenHint() {
  document.querySelector('.fs-hint')?.remove();
  clearTimeout(hintTimer);
  const hint = document.createElement('div');
  hint.className = 'fs-hint';
  hint.innerHTML =
    '<b>This browser cannot go full screen</b>'
    + '<span>Open this page in <b>Safari</b>, tap the Share button, '
    + 'then <b>Add to Home Screen</b>. Launching from that icon fills the whole screen.</span>';
  document.body.appendChild(hint);
  hint.addEventListener('click', () => hint.remove());
  hintTimer = setTimeout(() => hint.remove(), 9000);
}

function toggleFullscreen() {
  const open = fullscreenElement();
  if (open) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    return;
  }
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) {
    showFullscreenHint();
    return;
  }
  /* Older WebKit returns undefined instead of a promise */
  Promise.resolve(request.call(el)).catch(showFullscreenHint);
}

/* ---------- Persistent top bar (star counter / mute / home) ---------- */
function buildTopBar(showHome) {
  topbar.innerHTML = '';
  if (unsubStars) unsubStars();
  if (unsubMuted) unsubMuted();

  const left = document.createElement('div');
  left.className = 'tb-side tb-left';
  if (showHome) {
    const home = document.createElement('button');
    home.className = 'tb-btn';
    home.innerHTML = '🏠';
    home.setAttribute('aria-label', 'Home');
    home.addEventListener('pointerdown', () => sound.pick());
    home.addEventListener('click', () => goTo('hub'));
    left.appendChild(home);
  }

  const right = document.createElement('div');
  right.className = 'tb-side tb-right';

  const starPill = document.createElement('div');
  starPill.className = 'tb-pill tb-star';
  starPill.innerHTML = `<span class="tb-star-ico">⭐</span><span class="tb-star-count">${storage.getStars()}</span>`;
  right.appendChild(starPill);

  /* Pointless once the app is already filling the screen from a home screen
   * icon, so it only shows up in a browser tab. */
  if (!isStandalone()) {
    const fsBtn = document.createElement('button');
    fsBtn.className = 'tb-btn tb-fs';
    fsBtn.innerHTML = fullscreenElement() ? FS_EXIT_ICON : FS_ICON;
    fsBtn.setAttribute('aria-label', 'Full screen');
    fsBtn.addEventListener('click', toggleFullscreen);
    right.appendChild(fsBtn);
  }

  const muteBtn = document.createElement('button');
  muteBtn.className = 'tb-btn tb-mute';
  muteBtn.innerHTML = storage.isMuted() ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', 'Sound');
  muteBtn.addEventListener('click', () => {
    const m = !storage.isMuted();
    storage.setMuted(m);
    if (m) {
      sound.cancelSpeech();
    } else {
      sound.ensure();
      sound.chime();
    }
  });
  right.appendChild(muteBtn);

  /* Kept as an empty flex spacer so the star pill and mute button stay put.
   * It used to hold a hardcoded player badge, which duplicated the hub's own
   * greeting row and was simply wrong whenever the other child was the one
   * playing - the app never knows who is holding the iPad. */
  const center = document.createElement('div');
  center.className = 'tb-center';

  topbar.append(left, center, right);

  unsubStars = storage.onChange('stars', (v) => {
    const c = starPill.querySelector('.tb-star-count');
    if (c) c.textContent = v;
    starPill.classList.remove('bump');
    void starPill.offsetWidth;
    starPill.classList.add('bump');
  });
  unsubMuted = storage.onChange('muted', (m) => { muteBtn.innerHTML = m ? '🔇' : '🔊'; });
}

/* ---------- Scene router ---------- */
function goTo(id) {
  const scene = SCENES[id];
  if (!scene) return;
  if (currentId === id && current) return; // already there

  if (current && typeof current.unmount === 'function') {
    try { current.unmount(); } catch (e) { /* never block navigation */ }
  }
  sound.cancelSpeech();

  currentId = id;
  current = scene;

  /* Cross-dissolve: the outgoing scene fades under the incoming one instead
   * of the stage blanking for a frame. The old root is removed on its own
   * timer, so a fast double-tap can never strand two live scenes. */
  const old = stage.querySelector('.scene-root');
  if (old) {
    old.classList.remove('fade-in');
    old.classList.add('fade-out');
    setTimeout(() => old.remove(), 220);
  }

  stage.className = 'scene-' + id;
  buildTopBar(id !== 'hub');

  const root = document.createElement('div');
  root.className = 'scene-root fade-in';
  stage.appendChild(root);
  scene.mount(root, ctx);
}

/* The top bar is rebuilt on every scene change, so the icon is kept in sync
 * here rather than being captured per button. */
['fullscreenchange', 'webkitfullscreenchange'].forEach((evt) => {
  document.addEventListener(evt, () => {
    const btn = topbar.querySelector('.tb-fs');
    if (btn) btn.innerHTML = fullscreenElement() ? FS_EXIT_ICON : FS_ICON;
  });
});

/* ---------- Global toddler-proofing ---------- */
// Unlock Web Audio on the very first interaction (iOS requirement)
document.addEventListener('pointerdown', () => sound.ensure(), { capture: true });

// Kill rubber-band scrolling & double-tap zoom behaviors
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Resume audio when returning to the tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && sound.ctx && sound.ctx.state === 'suspended') sound.ctx.resume();
});

// Offline support (production builds only - dev server stays cache-free)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

goTo('hub');
