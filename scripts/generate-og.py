# Renders public/og-image.png (1200x630) for the link preview cards.
#
# Drawn from a standalone HTML card, NOT a screenshot of the hub: the running
# app shows the player's name, and the OG image is the one asset that is
# fetched and cached by every chat app a link is pasted into.
#
# Run: python scripts/generate-og.py       (no server needed)
import os
from playwright.sync_api import sync_playwright

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'public', 'og-image.png'))

# The show's palette, same values as src/utils/blocks.js
BLOCKS = [('#ef4444', 1), ('#f97316', 2), ('#facc15', 3), ('#22c55e', 4), ('#38bdf8', 5)]

cubes = ''.join(
    f'<div class="stack">' + ''.join(f'<div class="cube" style="--c:{c}"></div>' for _ in range(n)) +
    f'<div class="face"><span class="eye"></span><span class="eye"></span></div></div>'
    for c, n in BLOCKS
)

HTML = f"""
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    width:1200px; height:630px; overflow:hidden;
    font-family:'Segoe UI',system-ui,sans-serif;
    background:
      radial-gradient(70% 60% at 12% -10%, rgba(255,255,255,.95) 0%, transparent 60%),
      radial-gradient(80% 70% at 88% 110%, rgba(147,197,253,.55) 0%, transparent 62%),
      linear-gradient(165deg,#fffdf3 0%,#dceeff 100%);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px;
  }}
  h1 {{ font-size:74px; font-weight:900; color:#1e293b; letter-spacing:-2px; }}
  p  {{ font-size:31px; font-weight:600; color:#475569; }}
  .row {{ display:flex; align-items:flex-end; gap:26px; }}
  .stack {{ position:relative; display:flex; flex-direction:column-reverse; gap:4px; }}
  .cube {{
    width:52px; height:52px; border-radius:10px; background:var(--c);
    border-bottom:6px solid rgba(0,0,0,.28);
    box-shadow: inset 0 3px 0 rgba(255,255,255,.55), 0 6px 14px rgba(23,34,58,.18);
  }}
  .face {{ position:absolute; left:0; right:0; bottom:16px; display:flex; justify-content:center; gap:10px; }}
  .eye {{
    width:15px; height:18px; border-radius:50%; background:#fff;
    border:2.5px solid #1e293b; position:relative;
  }}
  .eye::after {{
    content:''; position:absolute; left:3px; top:5px;
    width:7px; height:7px; border-radius:50%; background:#1e293b;
  }}
  .pills {{ display:flex; gap:14px; }}
  .pill {{
    font-size:22px; font-weight:700; color:#334155; background:#fff;
    padding:12px 24px; border-radius:999px; border-bottom:4px solid #cbd5e1;
    box-shadow:0 4px 12px rgba(23,34,58,.12);
  }}
</style></head><body>
  <h1>Number Playground</h1>
  <div class="row">{cubes}</div>
  <p>Ten counting mini-games for toddlers</p>
  <div class="pills">
    <span class="pill">No text to read</span>
    <span class="pill">No ads</span>
    <span class="pill">Works offline</span>
  </div>
</body></html>
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    pg.set_content(HTML, wait_until='load')
    pg.wait_for_timeout(300)
    pg.screenshot(path=OUT)
    b.close()

print(f'wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)')
