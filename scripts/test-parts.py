# Visual + behaviour check for the "Where does it go?" puzzle game.
# Screenshots every picture once and drags one piece into its hole.
# Run: python scripts/test-parts.py   (needs the preview server on :4173)
import json
import os

from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.shots'))
os.makedirs(OUT, exist_ok=True)

errors = []
seen = {}

def center(box):
    return box['x'] + box['width'] / 2, box['y'] + box['height'] / 2

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1180, 'height': 820})
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:4173/', wait_until='load', timeout=20000)
    page.wait_for_timeout(1200)

    drag_results = []
    for attempt in range(70):
        page.click('.card-parts', force=True)
        page.wait_for_timeout(900)
        pid = page.get_attribute('.pp-pic', 'data-puzzle')

        if pid not in seen:
            seen[pid] = True
            page.screenshot(path=os.path.join(OUT, f'8-parts-{pid}.png'))

        # drag the first tray piece onto a hole with the same key
        item = page.locator('.pp-item:not(.done)').first
        key = item.get_attribute('data-key')
        slot = page.locator(f'.pp-slot[data-key="{key}"]:not(.filled)').first
        ix, iy = center(item.bounding_box())
        sx, sy = center(slot.bounding_box())
        page.mouse.move(ix, iy)
        page.mouse.down()
        page.mouse.move((ix + sx) / 2, (iy + sy) / 2, steps=6)
        page.mouse.move(sx, sy, steps=6)
        page.mouse.up()
        page.wait_for_timeout(500)
        filled = page.locator('.pp-slot.filled').count()
        drag_results.append(f'{pid}:{key}:{"PASS" if filled else "FAIL"}')
        if pid not in seen or filled:
            page.screenshot(path=os.path.join(OUT, f'8-parts-{pid}-dropped.png'))

        page.click('#topbar .tb-left .tb-btn', force=True)
        page.wait_for_timeout(400)
        if len(seen) == 12:
            break

    browser.close()

print('PUZZLES_SEEN:' + json.dumps(sorted(seen)))
print('DRAGS:' + json.dumps(drag_results))
print('CONSOLE_ERRORS:' + json.dumps(errors))
