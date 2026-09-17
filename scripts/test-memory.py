# Visual + behaviour check for "Peek & Match" (scene id `memory`).
# Opens the scene, reads card identity out of data-item/data-theme attributes,
# clears a round by clicking matching pairs in order, and checks the star
# counter went up. Screenshots the preview, the face-down grid, a matched
# pair and the win screen.
# Run: python scripts/test-memory.py   (needs the dev server on :5183)
import json
import os

from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.shots'))
os.makedirs(OUT, exist_ok=True)

errors = []


def stars(page):
    return int(page.text_content('.tb-star-count') or '0')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1180, 'height': 820})
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:4173/', wait_until='load', timeout=20000)
    page.wait_for_timeout(600)

    page.click('.card-memory', force=True)
    page.wait_for_timeout(400)

    # ---- opening face-up preview (all six cards showing their art) ----
    page.wait_for_selector('.mem-card')
    page.screenshot(path=os.path.join(OUT, '11-memory-preview.png'))

    # ---- wait for the flip-down, then the face-down grid ----
    page.wait_for_timeout(1500)
    page.wait_for_function(
        "document.querySelectorAll('.mem-card.is-up').length === 0"
    )
    page.screenshot(path=os.path.join(OUT, '11-memory-facedown.png'))

    # ---- read identity of every card straight from the DOM ----
    cards = page.eval_on_selector_all(
        '.mem-card',
        "els => els.map((el, i) => ({ i, item: el.dataset.item, theme: el.dataset.theme }))"
    )
    theme = cards[0]['theme']
    by_item = {}
    for c in cards:
        by_item.setdefault(c['item'], []).append(c['i'])
    pairs = [idxs for idxs in by_item.values() if len(idxs) == 2]

    stars_before = stars(page)
    assert len(pairs) == 3, f'expected 3 pairs, saw {by_item}'

    # ---- clear the round: tap every pair in order ----
    match_shot_taken = False
    for a, b in pairs:
        page.click(f'.mem-card:nth-child({a + 1})', force=True)
        page.wait_for_timeout(250)
        page.click(f'.mem-card:nth-child({b + 1})', force=True)
        page.wait_for_timeout(350)
        if not match_shot_taken:
            page.screenshot(path=os.path.join(OUT, '11-memory-match.png'))
            match_shot_taken = True

    # ---- win: confetti + star ----
    page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(OUT, '11-memory-win.png'))
    stars_after = stars(page)

    browser.close()

print('THEME:' + theme)
print('PAIRS:' + json.dumps(pairs))
print('STARS_BEFORE:' + str(stars_before))
print('STARS_AFTER:' + str(stars_after))
print('STAR_INCREASED:' + str(stars_after > stars_before))
print('CONSOLE_ERRORS:' + json.dumps(errors))

assert stars_after > stars_before, 'star counter did not increase after completing the round'
assert not errors, f'console errors: {errors}'
print('OK')
