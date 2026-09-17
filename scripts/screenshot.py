# Visual smoke test: drives the app in the ALREADY-INSTALLED Python Playwright
# (uses the existing %LOCALAPPDATA%\ms-playwright browser cache - no downloads).
# Run:  python scripts/screenshot.py   (needs the preview server on :4173)
import json
import os

from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.shots'))
os.makedirs(OUT, exist_ok=True)

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1180, 'height': 820})
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto('http://localhost:4173/', wait_until='load', timeout=20000)
    page.wait_for_timeout(1600)
    page.screenshot(path=os.path.join(OUT, '1-hub.png'))

    games = [
        ('.card-snap', '2-snap.png'),
        ('.card-feed', '3-feed.png'),
        ('.card-tower', '4-tower.png'),
        ('.card-trace', '5-trace.png'),
    ]
    for sel, shot in games:
        page.click(sel, force=True)  # cards float forever - skip stability check
        page.wait_for_timeout(1300)
        page.screenshot(path=os.path.join(OUT, shot))
        if page.locator('#topbar .tb-left .tb-btn').count():
            page.click('#topbar .tb-left .tb-btn', force=True)
            page.wait_for_timeout(450)

    # drag test: carry the rightmost 1-block to the top-left; it must stay there
    page.click('.card-snap', force=True)
    page.wait_for_timeout(1200)
    block = page.locator('.nb-block').nth(2)
    b = block.bounding_box()
    page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
    page.mouse.down()
    page.mouse.move(150, 110, steps=14)
    page.mouse.up()
    page.wait_for_timeout(500)
    b2 = block.bounding_box()
    ok = b2['y'] < 230 and b2['x'] < 330
    print('DRAG_TEST:' + ('PASS' if ok else f'FAIL y={b2["y"]:.0f} x={b2["x"]:.0f}'))
    page.screenshot(path=os.path.join(OUT, '2b-snap-drag.png'))
    page.click('#topbar .tb-left .tb-btn', force=True)
    page.wait_for_timeout(450)

    # numeral "4" check (next button x3 from numeral 1)
    page.click('.card-trace', force=True)
    page.wait_for_timeout(800)
    for _ in range(3):
        page.click('.nav-next', force=True)
        page.wait_for_timeout(320)
    page.screenshot(path=os.path.join(OUT, '6-trace-4.png'))

    browser.close()

print('CONSOLE_ERRORS:' + json.dumps(errors))
print('SHOTS_DONE')
