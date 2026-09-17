# Deploying to a VPS that already runs Traefik

The app is a static site: 124 files, ~5 MB, no backend and no Node at runtime.
What is here is an nginx container plus the Traefik labels to route a hostname
at it.

## Why the build happens on your machine, not the server

`src/players.local.js`, `scripts/phrases.local.mjs` and `public/audio/local-*.wav`
are **gitignored** - that is what keeps a child's name and the family voice
recordings out of the public repository. A server-side `git pull && npm run build`
therefore produces the *generic* build, with the icon-only greeting button and
synthesised praise. `deploy.sh` builds locally and ships `dist/`, and warns if the
build it is about to send has no `local-*.wav` in it.

## First run

On the VPS:

```bash
mkdir -p /opt/numberblocks/deploy
```

Copy `.env.example` to `/opt/numberblocks/deploy/.env` and match it to the
Traefik that is already running. The three values that differ between setups:

```bash
docker network ls                  # TRAEFIK_NETWORK
docker inspect traefik | grep -i entrypoint   # TRAEFIK_ENTRYPOINT (often websecure)
                                   # TRAEFIK_CERTRESOLVER comes from traefik.yml
```

Point DNS at the box (`numberblocks.suneelp.com` → an A record for the VPS IP)
and wait for it to resolve before the first deploy, or Traefik's ACME challenge
fails and it will back off before retrying.

Then, from this checkout:

```bash
VPS=user@your-vps ./deploy/deploy.sh
```

## Updating

The same one command. It rebuilds, rsyncs and restarts the container.

After an update the **service worker** is what actually refreshes an installed
iPad. Bump `CACHE_NAME` in `public/sw.js` whenever audio or shell assets change,
or a device that has already installed the app keeps serving its old cache.
`nginx.conf` sends `no-store` for `index.html`, `sw.js` and `manifest.json` for
the same reason - cache those and an installed device is frozen for good.

## A note on what you are publishing

The build carries the personal recordings. `nginx.conf` sends
`X-Robots-Tag: noindex, nofollow, noarchive`, `index.html` carries the same meta
tag and `robots.txt` disallows everything, so it stays out of search results -
but a URL is still a URL, and anyone who has it can open it.

To shut it properly, uncomment the two `basicauth` lines in
`docker-compose.yml` and set `BASIC_AUTH` in `.env`:

```bash
htpasswd -nb someuser somepassword | sed -e 's/\$/\$\$/g'
```

(the `$$` escaping is required - docker compose eats single `$`.)
