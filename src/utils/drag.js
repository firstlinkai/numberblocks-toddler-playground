/* Pointer-event drag & drop for touch + mouse (iPad friendly).
 * Draggables must be absolutely positioned children of a positioned stage.
 *
 * makeDraggable(el, {
 *   bounds: stageEl,          // clamp dragging inside this rect
 *   getOrigin: () => ({x, y}) // current resting position (stage-local px)
 *   onStart, onMove, onDragStart, onEnd(e, {tap, moved, origX, origY}), onTap
 * })
 */
export function makeDraggable(el, opts = {}) {
  const getOrigin = opts.getOrigin || (() => ({ x: el.offsetLeft, y: el.offsetTop }));
  let pid = null;
  let startPX = 0, startPY = 0;
  let origX = 0, origY = 0;
  let moved = false;

  el.classList.add('draggable');

  el.addEventListener('pointerdown', (e) => {
    if (pid !== null || el.classList.contains('locked')) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(pid); } catch (err) { /* ignore */ }
    if (opts.onStart) opts.onStart(e);
    const o = getOrigin();
    origX = o.x; origY = o.y;
    startPX = e.clientX; startPY = e.clientY;
    moved = false;
    el.classList.add('dragging');
  });

  el.addEventListener('pointermove', (e) => {
    if (pid !== e.pointerId) return;
    const dx = e.clientX - startPX;
    const dy = e.clientY - startPY;
    if (!moved && Math.hypot(dx, dy) > 8) {
      moved = true;
      if (opts.onDragStart) opts.onDragStart(e);
    }
    if (!moved) return;
    let nx = origX + dx;
    let ny = origY + dy;
    if (opts.bounds) {
      const r = opts.bounds.getBoundingClientRect();
      nx = Math.min(Math.max(nx, 0), r.width - el.offsetWidth);
      ny = Math.min(Math.max(ny, 0), r.height - el.offsetHeight);
    }
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
    if (opts.onMove) opts.onMove(e, nx, ny);
  });

  const finish = (e) => {
    if (pid !== e.pointerId) return;
    pid = null;
    el.classList.remove('dragging');
    const tap = !moved;
    if (tap && opts.onTap) opts.onTap(e);
    if (opts.onEnd) opts.onEnd(e, { tap, moved, origX, origY });
    moved = false;
  };

  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

/* Hit-test: topmost element matching `selector` at client coords,
 * skipping `exclude` (the element being dragged) and its children. */
export function hitTest(clientX, clientY, selector, exclude = null) {
  const stack = document.elementsFromPoint(clientX, clientY) || [];
  for (const el of stack) {
    if (exclude && (el === exclude || exclude.contains(el))) continue;
    const hit = el.closest(selector);
    if (hit) return hit;
  }
  return null;
}

/* Animate an absolutely-positioned element back to its resting spot */
export function returnHome(el, x, y, done) {
  el.classList.add('returning');
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  setTimeout(() => {
    el.classList.remove('returning');
    if (done) done();
  }, 270);
}
