# Focused probe: why does Y lag during drag?
import json

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    pg = browser.new_page(viewport={'width': 1180, 'height': 820})
    pg.goto('http://localhost:4173/', wait_until='load')
    pg.wait_for_timeout(1200)
    pg.click('.card-snap', force=True)
    pg.wait_for_timeout(1300)

    print('GEOM:', json.dumps(pg.evaluate("""() => {
      const root = document.querySelector('.scene-root');
      const stage = document.getElementById('stage');
      const blocks = [...document.querySelectorAll('.nb-block')].map((el) => ({
        top: el.style.top, left: el.style.left, oh: el.offsetHeight, ow: el.offsetWidth
      }));
      return {
        root: root.getBoundingClientRect().toJSON(),
        stage: stage.getBoundingClientRect().toJSON(),
        blocks
      };
    }""")))

    blk = pg.locator('.nb-block').nth(2)
    bb = blk.bounding_box()
    sx, sy = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    pg.mouse.move(sx, sy)
    pg.mouse.down()
    for i in range(1, 15):
        pg.mouse.move(sx + (150 - sx) * i / 14, sy + (110 - sy) * i / 14)
        top = pg.evaluate("() => [...document.querySelectorAll('.nb-block')].map(e => e.style.top)")
        print(f'move {i}: draggedTop={top[-1]}')
    pg.mouse.up()
    pg.wait_for_timeout(400)
    print('FINAL:', json.dumps(pg.evaluate("""() => [...document.querySelectorAll('.nb-block')].map((el) => ({
      top: el.style.top, left: el.style.left, v: el.dataset.value
    }))""")))
    browser.close()
