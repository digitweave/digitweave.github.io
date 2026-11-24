# DigitWeave Numbers Game (Browser + PWA)

A standalone, offline-capable browser version of the Numbers Game.

## Features

- Manual and automatic play modes
- Search-based Hint, optional pair validation, and feedback before append
- Collapsible empty-row runs to keep long boards readable
- Undo/redo controls on the game board
- Offscreen column shortcuts and a bottom toolbar on phones
- Round summaries with pair accuracy and adjustable confetti
- Installable PWA with local-only storage

## Run locally

```bash
npx --yes serve@latest . -l 8080
```

Open `http://127.0.0.1:8080/`.

## Quick validation

With the server running, use a second terminal from the repository root.

```bash
node --check app.js
node --check game-rules.js
node --check hint-worker.js
node --check sw.js
curl -fsSI http://127.0.0.1:8080/
curl -fsSI http://127.0.0.1:8080/sw.js
curl -fsSI http://127.0.0.1:8080/manifest.webmanifest
```

For UI changes, also verify manual play, auto run/stop, persistence after reload, and the `Collapse empty rows` toggle in the browser.

## Publish on GitHub Pages

For a direct root URL with your organization:

1. Create repository: `digitweave.github.io` under `digitweave`
2. Push this folder content as the repository root
3. Enable Pages (GitHub Actions or branch source)
4. Site URL becomes: `https://digitweave.github.io/`

## Credits

- Original game idea and product direction: project creator
- Implementation and engineering assistance: OpenAI Codex

## License

MIT — see `LICENSE`.
