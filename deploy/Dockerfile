# Build context is the project root (see docker-compose), so paths below are
# repo-relative. Static site, built on the host and copied in. Nothing runs at runtime but
# nginx: the app has no backend, no database and no Node process.
FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

# nginx:alpine already runs as root then drops to nginx for workers; nothing
# here writes to disk, so the container can be read-only (see compose).
