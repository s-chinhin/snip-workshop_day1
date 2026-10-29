# Snip

A tiny URL shortener built to show one idea: **one backend, two very different
clients**. A web app and a terminal CLI both use the same small HTTP API.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/api/links` | `{ "url": "https://…" }` | `201` `{ code, url, shortUrl, hits, createdAt }` · `400` on invalid JSON/URL |
| `GET`  | `/api/links` | — | `200` array of all links |
| `GET`  | `/:code` | — | `302` to the original URL (+1 hit) · `404` if unknown |

Links live in an in-memory `Map`, so restarting the server clears them. That's on
purpose.

## Layout: one branch per layer, mounted as submodules

Each layer lives on its own **orphan branch** of this repo, with its own history and
its files at the branch root. `main` holds no app code. It mounts each branch as a
**git submodule** that's pinned to an exact commit:

| Folder | Branch | What |
|--------|--------|------|
| `backend/` | `backend` | Bun API server, zero dependencies |
| `frontend/` | `frontend` | Angular 19 web app |
| `cli/` | `cli` | Zero-dependency Node CLI |
| `bundle/` | `bundle` | **Generated** release: server + built UI + CLI |

## Clone

```bash
git clone --recurse-submodules https://github.com/s-chinhin/snip-workshop_day1.git
```

A plain `git clone` leaves the submodule folders empty. To fix that in an existing
clone, run `git submodule update --init --recursive`.

## Run

You need Bun 1.x and Node 20+. Use three terminals from the repo root:

```bash
cd backend  && bun start                 # API on http://localhost:3000
cd frontend && npm i && npx ng serve     # web UI on http://localhost:4200
cd cli      && node cli.js ls            # same links from the terminal
```

## Updating a layer

Each submodule folder is a full checkout of its branch. Commit there, then move the
pointer on `main`:

```bash
cd backend
git add -A && git commit -m "..." && git push      # advances origin/backend
cd ..
git submodule update --remote backend              # move the pointer
git add backend && git commit -m "Bump backend submodule" && git push
```

The layer commit and the pointer commit are separate. That way `main` is always a
pinned, reproducible snapshot of the whole app.

## The release bundle

`bundle/` is **generated output**. Don't edit it by hand. `scripts/build-bundle.mjs`
moves the source submodules to their branch tips, builds the Angular app, and
assembles one folder: `server.js`, the UI in `public/`, `cli.js`, an `.env` with
`PUBLIC_DIR=./public`, a `Dockerfile`, and a `railway.json`. It then commits the
release inside `bundle/` and bumps the pointers on `main`. When nothing changed, it
commits nothing.

```bash
node scripts/build-bundle.mjs           # build + commit locally
node scripts/build-bundle.mjs --push    # ...and push the bundle branch and main
cd bundle && bun start                  # ONE process: UI + API + redirects on :3000
docker build -t snip bundle && docker run --rm -p 3000:3000 snip
```
