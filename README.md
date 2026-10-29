# Snip CLI

A zero-dependency Node (20+) terminal client for the Snip backend. It's a CommonJS
file using the global `fetch`.

```bash
node cli.js add https://example.com   # prints the short URL
node cli.js ls                        # code / hits / url table
node cli.js open <code>               # opens the target in your browser
node cli.js help
```

Wrappers forward their arguments to `cli.js`: `./snip` (macOS/Linux), `snip.cmd`
(cmd), and `snip.ps1` (PowerShell). Run `npm link` to install `snip` globally.

The backend URL comes from `SNIP_API` (default `http://localhost:3000`). Errors go to
stderr and exit with code 1.

Keep this file CommonJS: don't add `"type": "module"` to `package.json`, because the
release bundle runs `cli.js` from a CommonJS folder.
