/* Tiny localStorage wrapper: stars, unlocked number-blocks, mute state.
 * Emits change events so the UI (star counter, mute button) stays in sync. */
const KEYS = {
  STARS: 'nbp_stars',
  UNLOCKED: 'nbp_unlocked',
  MUTED: 'nbp_muted'
};

const listeners = { stars: [], unlocked: [], muted: [] };

export const MAX_NUMBER = 50;

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { /* storage unavailable (private mode) - play without saving */ }
}

function emit(key, val) {
  listeners[key].forEach((cb) => {
    try { cb(val); } catch (e) { /* keep other listeners alive */ }
  });
}

export const storage = {
  getStars() {
    return Math.max(0, Math.floor(read(KEYS.STARS, 0) || 0));
  },

  addStar(n = 1) {
    const total = this.getStars() + n;
    write(KEYS.STARS, total);
    emit('stars', total);
    return total;
  },

  /* Numbers 0-50 can be unlocked (Snap merges and Tower Jump both reach 50) */
  /* 0 and 1 need no achievement to earn - 0 is nothing, 1 is the starting
   * block every child already has - so both are always unlocked. */
  getUnlocked() {
    const arr = read(KEYS.UNLOCKED, []);
    const list = Array.isArray(arr)
      ? arr.filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_NUMBER)
      : [];
    if (!list.includes(0)) list.push(0);
    if (!list.includes(1)) list.push(1);
    return list.sort((a, b) => a - b);
  },

  unlockNumber(n) {
    const list = this.getUnlocked();
    if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) return list;
    if (!list.includes(n)) {
      list.push(n);
      list.sort((a, b) => a - b);
      write(KEYS.UNLOCKED, list);
      emit('unlocked', list);
    }
    return list;
  },

  isMuted() {
    try {
      return localStorage.getItem(KEYS.MUTED) === '1';
    } catch (e) {
      return false;
    }
  },

  setMuted(muted) {
    try {
      localStorage.setItem(KEYS.MUTED, muted ? '1' : '0');
    } catch (e) { /* ignore */ }
    emit('muted', muted);
  },

  onChange(key, cb) {
    if (!listeners[key]) return () => {};
    listeners[key].push(cb);
    return () => {
      const i = listeners[key].indexOf(cb);
      if (i >= 0) listeners[key].splice(i, 1);
    };
  }
};
