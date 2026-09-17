# Verifies Tower Jump builds random consecutive windows (e.g. 15,16,?,18,19)
from playwright.sync_api import sync_playwright

def round_info(pg):
    return pg.evaluate("""() => ({
      steps: [...document.querySelectorAll('.stairs .step-cube .nb-num')].map((e) => +e.textContent),
      holes: document.querySelectorAll('.gap-hole').length,
      choices: [...document.querySelectorAll('.choice-cube .nb-num')].map((e) => +e.textContent)
    })""")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 1180, 'height': 820})
    all_ok = True
    for trial in range(4):
        pg.goto('http://localhost:4173/', wait_until='load')
        pg.wait_for_timeout(1200)
        pg.click('.card-tower', force=True)
        pg.wait_for_timeout(900)
        info = round_info(pg)
        nums = sorted(info['steps'])
        consecutive = (max(nums) - min(nums) == 4) and (len(set(nums)) == 4)
        fills = any(
            (lambda s: s[-1] - s[0] == 4 and len(set(s)) == 5)(sorted(info['steps'] + [c]))
            for c in info['choices']
        )
        in_range = all(1 <= v <= 50 for v in info['steps'] + info['choices'])
        ok = consecutive and fills and in_range and info['holes'] == 1
        all_ok = all_ok and ok
        print(f"TRIAL {trial}: steps={info['steps']} choices={info['choices']} "
              f"consecutive={consecutive} choiceFills={fills} range={in_range} -> {'OK' if ok else 'BAD'}")
    b.close()
print('TOWER_TEST:' + ('PASS' if all_ok else 'FAIL'))
