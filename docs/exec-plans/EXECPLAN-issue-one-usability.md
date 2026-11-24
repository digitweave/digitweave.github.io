# Improve board feedback, navigation, and celebration controls

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

With pair validation on, selecting a digit marks the closest reachable
digits in the four scan directions. A tall board displays each column's
closest uncrossed digit above and below the visible area. Selecting an
indicator scrolls to its digit. On narrow screens, the toolbar keeps Undo
and Controls at the bottom. Advanced Setup lets players set confetti from
0 to 32 pieces, with the current eight-piece celebration as the default.

## Progress

- [x] (2026-11-24 10:11 UTC) Review the GitHub request and current board,
  responsive layout, and finish dialog. Delegate design and verification.
- [x] (2026-11-24 10:15 UTC) Implement and integrate nearest-neighbor
  feedback, column context, mobile controls, and the confetti setting.
- [x] (2026-11-24 10:19 UTC) Verify browser behavior and the offline cache
  upgrade.

## Surprises and discoveries

- The current renderer knows which pairs are legal, but it colors all other
  uncrossed cells red. The nearest visible digit in a direction can be
  identified by the same scan the game uses for pair visibility.
- Wide boards scroll inside `.board-panel`, and narrow boards scroll with
  the document. Fully crossed rows can collapse out of the normal grid.

## Decision log

- 2026-11-24, Codex. Share a directional scan between pair detection and
  the selected digit's preview. Use the existing rightward row wrap and
  ignore crossed cells when finding a neighbor.
- 2026-11-24, Codex. Place column indicators at the top and bottom of the
  visible board. Find the closest offscreen rendered uncrossed digit per
  column. Let a player jump to an indicated digit without taking a turn.
- 2026-11-24, Codex. Reposition the existing mobile toolbar and retain its
  actions. Persist the confetti amount in the existing settings and keep
  reduced-motion behavior. [GitHub issue #1](https://github.com/digitweave/digitweave.github.io/issues/1)

## Context and milestones

`app.js` owns `findPairs()`, `renderBoard()`, and the result dialog.
`index.html` defines the toolbar, board, and `Advanced Setup`. The lead
owns the markup, application behavior, and worker cache bump. A subagent
owns the corresponding responsive and board context rules in `styles.css`.

1. Share visibility scans and limit the colored previews to the selected
   digit's nearest reachable neighbors while validation is enabled.
2. Align two sticky indicator rows with the rendered board columns. Batch
   scroll updates and search the ordered cells in each column for nearest
   offscreen digits. Keep mobile toolbar and indicators at separate insets.
3. Save the confetti amount in Controls. On a fresh finish render that
   number of particles, reusing the existing animation and original eight
   positions. Refresh cached app assets with a service worker version bump.

## Validation and recovery

From the repository root run `node --check app.js`, `node --check sw.js`, and
the scoped Git whitespace check. Serve with `npx --yes serve@latest . -l 8080`
and confirm HTTP 200 for `/`, `/sw.js`, and `/manifest.webmanifest`.

In Chromium, select an interior digit surrounded by crossed cells and
confirm only the nearest reachable digits receive feedback. Turn validation
off and verify previews disappear. Use tall boards with uncrossed digits
separated by crossed cells, collapsed rows, and missing values in a column.
Scroll both the wide board and narrow document. Verify the edge values,
jumps, fixed mobile controls and safe access to the last row. Try the
default, maximum and zero confetti amounts, reload and reset settings,
and exercise reduced motion and offline operation after upgrading the worker.

## Outcomes and retrospective

- Nearest-neighbor previews followed the checkbox and respected crossed
  cells and horizontal row wrap. The exact pair list and order matched v11
  on 500 seeded boards.
- Chromium at 1366px, 360px, and 320px showed the expected nearest values in
  both sticky strips, including on collapsed rows and an 18-column board.
  Context buttons focused the original digit. Mobile Controls and Undo
  worked after scrolling, and the final row and append button were reachable.
- The slider persisted 0, 8, and 32 pieces, and reset restored eight. The
  default used the original positions and reduced motion disabled animation.
  An updated v12 client kept a 13-piece setting, finished a round offline,
  and restored the round on reload. The v11 cache was retired.
- JavaScript syntax, scoped whitespace, static HTTP, and the manual and
  automatic finish, append, history, and reset smoke checks passed.
