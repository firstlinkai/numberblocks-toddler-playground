# Connect the Dots: tap every dot in order, assert the picture completes and a
# star is awarded, and screenshot each picture.
# Run: python scripts/test-dots.py     (needs the preview server on :4173)
import json, os
from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.shots'))
os.makedirs(OUT, exist_ok=True)
errors, rounds = [], []
seen = []

with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    pg = br.new_page(viewport={'width': 1180, 'height': 820})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://localhost:4173/', wait_until='load', timeout=20000)
    pg.wait_for_timeout(1200)
    pg.evaluate("localStorage.clear()")
    pg.reload(wait_until='load')
    pg.wait_for_timeout(1200)
    pg.click('.card-dots', force=True)
    pg.wait_for_timeout(1400)

    for _ in range(6):
        shape = pg.get_attribute('.scene-root', 'data-shape')
        n = pg.locator('.dot').count()
        if shape not in seen:
            seen.append(shape)
            pg.screenshot(path=os.path.join(OUT, f'9-dots-{shape}.png'))
        for i in range(n):
            pg.locator('.dot').nth(i).click(force=True)
            pg.wait_for_timeout(260)
        pg.wait_for_timeout(1000)
        done = pg.locator('.dots-scene.done, .scene-root.done').count() > 0
        rounds.append(f'{shape}: {n} dots, done={done}')
        pg.screenshot(path=os.path.join(OUT, f'9-dots-{shape}-done.png'))
        pg.wait_for_timeout(2800)   # celebration + next picture

    stars = pg.text_content('.tb-star-count')
    br.close()

print('SHAPES:' + json.dumps(seen))
print('ROUNDS:' + json.dumps(rounds))
print('STARS:' + stars)
print('CONSOLE_ERRORS:' + json.dumps(errors))
