# Sort It!: drive every sorting rule to completion and assert a star is given.
# Each item carries data-bin (its correct side) and the scene root carries
# data-rule, so the test drops into the RIGHT bin instead of guessing - a
# guessing test reports failures the game never had.
# Run: python scripts/test-sort.py     (needs the preview server on :4173)
import json, os
from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.shots'))
os.makedirs(OUT, exist_ok=True)
errors, results = [], []

def center(b):
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

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
    pg.click('.card-sort', force=True)
    pg.wait_for_timeout(1600)

    seen = []
    for _ in range(4):
        rule = pg.get_attribute('.scene-root', 'data-rule')
        total = pg.locator('.sort-item').count()
        if rule not in seen:
            seen.append(rule)
            pg.screenshot(path=os.path.join(OUT, f'10-sort-{rule}.png'))
        for _ in range(total):
            item = pg.locator('.sort-item:not(.sorted)').first
            if item.count() == 0:
                break
            side = item.get_attribute('data-bin')
            ix, iy = center(item.bounding_box())
            bx, by = center(pg.locator(f'.sort-bin-{side}').bounding_box())
            pg.mouse.move(ix, iy)
            pg.mouse.down()
            pg.mouse.move((ix + bx) / 2, (iy + by) / 2, steps=8)
            pg.mouse.move(bx, by, steps=8)
            pg.mouse.up()
            pg.wait_for_timeout(380)
        sorted_n = pg.locator('.sort-item.sorted').count()
        results.append(f'{rule}: {sorted_n}/{total}')
        pg.wait_for_timeout(3400)   # celebration + next round

    stars = pg.text_content('.tb-star-count')
    pg.screenshot(path=os.path.join(OUT, '10-sort-win.png'))
    br.close()

print('RULES_SEEN:' + json.dumps(seen))
print('ROUNDS:' + json.dumps(results))
print('STARS:' + stars)
print('CONSOLE_ERRORS:' + json.dumps(errors))
