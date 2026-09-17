# The rest reminder: assert it stays quiet before 20 minutes of play, fires at
# 20, and fires again on the next 20. Playwright's fake clock drives it, so the
# test takes a second rather than 40 minutes.
# Run: python scripts/test-rest.py     (needs the preview server on :4173)
import json
from playwright.sync_api import sync_playwright

audio, errors = [], []

with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    pg = br.new_page(viewport={'width': 1180, 'height': 820})
    pg.on('response', lambda r: audio.append(r.url.split('/')[-1]) if '/audio/' in r.url else None)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    # The WAV is cached after the first play, so a second firing produces no
    # network request. Count sample playbacks instead - on an untouched hub the
    # rest line is the only thing that plays one.
    pg.clock.install()
    pg.add_init_script("""
      window.__plays = 0;
      const AC = window.AudioContext || window.webkitAudioContext;
      const make = AC.prototype.createBufferSource;
      AC.prototype.createBufferSource = function () {
        const src = make.call(this);
        const start = src.start.bind(src);
        src.start = (...a) => { window.__plays++; return start(...a); };
        return src;
      };
    """)
    pg.goto('http://localhost:4173/', wait_until='load')

    pg.clock.run_for('00:03')
    quiet_at_start = 'local-rest.wav' not in audio and 'rest.wav' not in audio

    pg.clock.run_for('19:00')
    quiet_at_19 = 'local-rest.wav' not in audio and 'rest.wav' not in audio

    pg.clock.run_for('01:10')
    pg.wait_for_timeout(500)
    fired = [a for a in audio if a in ('local-rest.wav', 'rest.wav')]

    plays_after_first = pg.evaluate('window.__plays')

    pg.clock.run_for('20:00')
    pg.wait_for_timeout(500)
    plays_after_second = pg.evaluate('window.__plays')
    br.close()

print('QUIET_BEFORE_20MIN:' + json.dumps(quiet_at_start and quiet_at_19))
print('FIRED_AT_20MIN:' + json.dumps(bool(fired)))
print('CLIP:' + json.dumps(fired[:1]))
print('PLAYS_AT_20MIN:' + json.dumps(plays_after_first))
print('FIRED_AGAIN_BY_40MIN:' + json.dumps(plays_after_second > plays_after_first))
print('CONSOLE_ERRORS:' + json.dumps(errors))
