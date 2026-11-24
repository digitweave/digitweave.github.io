# DigitWeave Numbers Game (Browser + PWA)

[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/digitweave/digitweave.github.io)

A standalone, offline-capable browser version of the Numbers Game.

## Live site

The game is live on GitHub Pages. [Play DigitWeave](https://digitweave.github.io/)

GitHub Pages publishes the static files from the repository root when changes
are pushed to `main`. [View deployment runs](https://github.com/digitweave/digitweave.github.io/actions/workflows/pages/pages-build-deployment)

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

## Credits

- Original game idea and product direction: project creator
- Implementation and engineering assistance: OpenAI Codex

## License

MIT — see `LICENSE`.
