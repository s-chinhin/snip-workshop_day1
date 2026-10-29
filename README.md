# Snip backend

A zero-dependency Bun URL shortener. Links are held in memory and are cleared when the server restarts.

## Run

```sh
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it, `BASE_URL` to control generated short links, or `RAILWAY_PUBLIC_DOMAIN` to use `https://<domain>` when `BASE_URL` is unset. Set `PUBLIC_DIR` to also serve static files from that directory; `/` serves `index.html`, and existing files take precedence over short codes.

## API

- `POST /api/links` with `{ "url": "https://example.com" }` creates a short link and returns `201` with `{ code, url, shortUrl, hits, createdAt }`. Invalid JSON or non-HTTP(S) URLs return `400`.
- `GET /api/links` returns all links.
- `GET /:code` redirects to the original URL with `302` and increments its hit count. Unknown codes return `404`.

All responses support open CORS, including `OPTIONS` preflight requests.