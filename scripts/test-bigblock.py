# Verifies the >10 base-10 column rendering by importing the real module
import json

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 1180, 'height': 820})
    pg.goto('http://localhost:5173/', wait_until='load')
    pg.wait_for_timeout(1000)
    res = pg.evaluate("""async () => {
      const m = await import('/src/utils/blocks.js');
      const stage = document.getElementById('stage');
      const el = m.makeBlock(50);
      el.style.left = '80px';
      el.style.top = '60px';
      stage.appendChild(el);
      await new Promise((r) => setTimeout(r, 150));
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        segs: el.querySelectorAll('.nb-seg').length,
        cols: el.querySelectorAll('.nb-col').length,
        num: el.querySelector('.nb-num').textContent,
        words: [m.numberWord(11), m.numberWord(20), m.numberWord(47), m.numberWord(50)],
        onScreen: r.top > 64 && r.bottom < 820 && r.left > 0 && r.right < 1180
      };
    }""")
    print('BIG50:' + json.dumps(res))
    pg.screenshot(path='.shots/7-block-50.png')
    b.close()
print('BLOCK_TEST_DONE')
