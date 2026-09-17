# Smoke test across every game: enter each scene, screenshot it, collect console
# errors. Run: python scripts/test-all.py   (needs the preview server on :4173)
import json, os
from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.shots'))
os.makedirs(OUT, exist_ok=True)
GAMES = ['snap', 'feed', 'tower', 'trace', 'instruments', 'match', 'parts', 'dots', 'sort', 'memory']
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 1180, 'height': 820})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://localhost:4173/', wait_until='load', timeout=20000)
    pg.wait_for_timeout(1400)
    pg.screenshot(path=os.path.join(OUT, '1-hub.png'))
    for g in GAMES:
        pg.click(f'.card-{g}', force=True)
        pg.wait_for_timeout(2200)
        pg.screenshot(path=os.path.join(OUT, f'all-{g}.png'))
        pg.click('#topbar .tb-left .tb-btn', force=True)
        pg.wait_for_timeout(500)
    b.close()

print('CONSOLE_ERRORS:' + json.dumps(errors))
