# homing.place, the landing page, as static files behind Caddy. Only our own server runs it.
FROM node:24-alpine AS site
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web web
RUN npm run build:site

FROM caddy:2-alpine
COPY web/site.Caddyfile /etc/caddy/Caddyfile
COPY --from=site /app/web/dist/site /srv
