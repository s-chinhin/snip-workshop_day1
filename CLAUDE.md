# Snip: agent rules

> Mirrored in `.github/copilot-instructions.md`. Keep both files in sync.

Snip is a tiny URL shortener. This repo is a **superproject**: `main` holds no app
code, only submodules. Each submodule points at another **orphan branch of this same
repo**, one branch per layer.

| Folder | Branch | Stack |
|--------|--------|-------|
| `backend/` | `backend` | Bun, single-file `server.js`, zero deps, in-memory `Map` |
| `frontend/` | `frontend` | Angular 19, standalone component + HttpClient service, signals |
| `cli/` | `cli` | Node 20+, CommonJS `cli.js`, zero deps, global `fetch` |
| `bundle/` | `bundle` | **Generated** release: server + built UI + CLI + Dockerfile |
| `scripts/build-bundle.mjs` | `main` | Assembles `bundle/` |
| `.github/workflows/` | `main` | `bundle.yml` (hourly rebuild), `docker.yml` (GHCR image) |

## API contract

Every client depends on this. Change it everywhere or nowhere.

- `POST /api/links` `{ url }` returns `201` `{ code, url, shortUrl, hits, createdAt }`, or `400` on invalid JSON/URL
- `GET /api/links` returns `200` with an array of links
- `GET /:code` returns `302` to the URL (+1 hit), or `404`

## Commands

```bash
git clone --recurse-submodules <repo>       # plain clones leave submodules empty
cd backend && bun start                     # :3000
cd frontend && npm i && npx ng serve        # :4200
cd cli && node cli.js ls                    # SNIP_API overrides the backend URL
node scripts/build-bundle.mjs [--push]      # rebuild the release; no-op if unchanged
```

## Workflow: edit, push, bump the pointer

1. Edit inside the submodule folder (it's a full checkout of its branch). Commit
   there and push to that branch.
2. On `main`, run `git submodule update --remote <path>`, `git add <path>`, then
   commit and push the pointer bump.
3. Run `node scripts/build-bundle.mjs --push` to roll it into a release. The bundle
   pointer bump then triggers the Docker workflow.

## Do / Don't

- **Don't hand-edit `bundle/`.** It's generated output. Change the source branch or
  the build script instead.
- **Keep `cli.js` CommonJS.** Don't add `"type": "module"` to `cli/package.json` or
  the generated `bundle/package.json`, because the bundle runs `cli.js` with plain
  node.
- **Don't rename the Angular project.** The build script needs
  `frontend/dist/snip-frontend/browser`.
- **Storage is in-memory on purpose.** Don't add a database unless asked.
- **`bundle.yml` is schedule-only on purpose.** A push trigger would never fire for
  other branches, because the file lives only on `main`.
- **`docker.yml` watches the `bundle` gitlink, not files.** The paths filter fires
  when the pointer moves.
- Keep the build script idempotent: only commit after checking the staged diff.
- Don't commit app code to `main`. It belongs on its layer branch.
