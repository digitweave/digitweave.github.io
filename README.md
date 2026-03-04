# DigitWeave Numbers Game (Browser + PWA)

A standalone, offline-capable browser version of the Numbers Game.

## Features

- Manual and automatic play modes
- Optional pair validation and non-revealing feedback mode
- Undo/redo controls on the game board
- Responsive UI (phone drawers, wide-screen side panels)
- Installable PWA with local-only storage

## Run locally

```bash
cd web
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Publish on GitHub Pages

For a direct root URL with your organization:

1. Create repository: `digitweave.github.io` under `digitweave`
2. Push this folder content as the repository root
3. Enable Pages (GitHub Actions or branch source)
4. Site URL becomes: `https://digitweave.github.io/`

## Credits

- Original game idea and product direction: project creator
- Implementation and engineering assistance: OpenAI Codex (`GPT-5.3-Codex`)

## License

MIT — see `LICENSE`.
