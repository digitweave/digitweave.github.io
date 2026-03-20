# DigitWeave Execution Plans

This document defines how to write an execution plan, or "ExecPlan", for this repository. It adapts the OpenAI Codex ExecPlan guidance to the realities of this project: a static HTML/CSS/JavaScript app with no build step, localStorage persistence, and service-worker-based offline support.

An ExecPlan is a living, self-contained markdown document for substantial work. The reader should be able to pick up the current working tree, read only the ExecPlan, and implement or continue the task without outside context.

## When To Use An ExecPlan

Write an ExecPlan before implementing any non-trivial feature or refactor. In this repo that usually means changes to game logic, auto-play behavior, storage, PWA behavior, responsive layout, or any task that spans multiple files.

Tiny edits do not need an ExecPlan. Anything that changes behavior in more than one place probably does.

## Non-Negotiable Requirements

- Every ExecPlan must be fully self-contained.
- Every ExecPlan must be a living document that stays updated as work proceeds.
- Every ExecPlan must guide a novice through a complete, working outcome, not just a code diff.
- Every ExecPlan must define repo-specific jargon in plain language as soon as it appears.
- Every ExecPlan must name the exact files, functions, commands, and user-visible behaviors involved.
- Every ExecPlan must include validation that proves the feature works from a user point of view.

Purpose comes first. Start by explaining what a person can do after the change that they could not do before, and how to observe it working in this repository.

Do not rely on outside links or unstated history. If a plan needs context from code, embed that context in the plan in your own words.

## Repository Reality To Capture In Plans

The current app is organized like this:

- `index.html` is the only HTML entrypoint. It defines the board, drawers, toolbar, dialog, and all DOM hooks used by the script.
- `app.js` contains the entire client-side application. Important areas include `findPairs`, `crossPairIndices`, `appendRemainingDigits`, `choosePairSearch`, `manualSaveRound`, `runAutoStep`, `attachEvents`, `loadState`, and `registerPWA`.
- `styles.css` controls the visual system and responsive behavior, including the switch between narrow-screen drawers and wide-screen always-open panels.
- `sw.js` owns offline caching through `CACHE_NAME` and the `ASSETS` list.
- `manifest.webmanifest` and `icons/` support installability.

Plans should explicitly describe which of those areas are changing and why.

## Repo-Specific Validation Rules

This repo does not currently have an automated test suite. That means every ExecPlan must include both lightweight syntax checks and manual browser validation.

Run the baseline syntax checks from the repository root:

    node --check app.js
    node --check sw.js

The verified static server command in this devcontainer is:

    npx --yes serve@latest . -l 8080

If another environment already has an equivalent static file server available, that is fine, but the plan should still name the exact command it expects the reader to run.

Basic HTTP smoke checks are:

    curl -I http://127.0.0.1:8080/
    curl -I http://127.0.0.1:8080/sw.js
    curl -I http://127.0.0.1:8080/manifest.webmanifest

If the task affects behavior in the browser, the plan must also explain how to verify:

- board rendering and interaction
- manual mode actions
- auto mode actions when relevant
- persistence across reload when storage is involved
- reset behavior when storage keys or saved-state shape changes
- offline or install behavior when `sw.js`, `manifest.webmanifest`, or icons change

If you add automated tests in the future, include them in the plan, but do not replace user-visible validation with syntax-only checks.

## Formatting Rules

When the ExecPlan is the only content of a markdown file, write normal markdown without wrapping the whole file in triple backticks. If you need command examples or transcripts inside the plan, indent them instead of nesting fenced blocks inside fenced blocks.

Write in prose first. Use lists only when they make the instructions clearer. The one place where checkboxes are mandatory is `Progress`.

Use two newlines after headings and keep the plan readable enough that a new contributor can follow it top to bottom without guessing.

## Milestones And Living Sections

Every ExecPlan must include and maintain these sections:

- `Progress`
- `Surprises & Discoveries`
- `Decision Log`
- `Outcomes & Retrospective`

`Progress` must use timestamped checkboxes and always reflect the actual state of the work. If a step is partly done, split it into completed and remaining pieces instead of leaving the status ambiguous.

Milestones should read like a narrative. Each milestone should explain the scope of work, what new behavior will exist after it is complete, what files will change, what commands to run, and what someone should observe to confirm success.

If you change direction midstream, record that in `Decision Log` and update the rest of the plan so the document remains truthful.

## What Good Plans Must Spell Out In This Repo

For this project, strong ExecPlans are specific about all of the following when relevant:

- which `index.html` controls, sections, or IDs are changing
- which `app.js` functions or state fields are changing
- whether a storage schema or storage key is changing and how existing saves behave
- whether `CACHE_NAME` or the `ASSETS` list in `sw.js` must change
- whether new icons, manifest entries, or browser permissions are needed
- what happens on narrow screens versus wide screens
- what manual smoke test proves the user-facing behavior

Do not say "update the UI" or "adjust auto-play" without naming the exact files and functions that implement those behaviors here.

## ExecPlan Skeleton

Use this as the starting point for any task-specific ExecPlan:

```md
# <Short, action-oriented title>

This ExecPlan is a living document and must be maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Explain what the user gains after this change and how to see it working in the browser or through other observable behavior.

## Progress

- [ ] (YYYY-MM-DD HH:MMZ) Replace this with the first concrete step.
- [ ] Add more timestamped steps as the plan becomes more detailed.

## Surprises & Discoveries

- Observation: Note unexpected behavior, constraints, or browser quirks here.
  Evidence: Include a short command result, transcript, or source-based observation.

## Decision Log

- Decision: Record a concrete decision.
  Rationale: Explain why this path is the safest or clearest for this repo.
  Date/Author: YYYY-MM-DD, <name>

## Outcomes & Retrospective

Summarize what was completed, what remains, and what future contributors should know.

## Context and Orientation

Describe the current repository state as if the reader is new. Name the exact files and functions involved. Define any non-obvious term immediately.

## Plan of Work

Describe the edits in narrative order. Name the exact files to touch and the behavior each edit is responsible for. If changing `app.js`, call out the relevant functions by name. If changing the PWA behavior, explain the changes to `sw.js`, `manifest.webmanifest`, and any icons.

## Concrete Steps

State the exact commands to run and the working directory for each step.

    node --check app.js
    node --check sw.js
    npx --yes serve@latest . -l 8080

Add task-specific commands here as needed.

## Validation and Acceptance

Describe what to do in the browser and what to observe.

Include the default validation unless the task truly does not touch that area:

    node --check app.js
    node --check sw.js
    curl -I http://127.0.0.1:8080/

Then add a manual smoke test such as:

1. Open `http://127.0.0.1:8080/`.
2. Start a new game and confirm the board renders and responds to clicks.
3. Exercise the changed behavior.
4. Reload and confirm persistence if the task touches storage.
5. Confirm reset, install, or offline behavior if the task touches PWA features.

Phrase acceptance as observable behavior, not implementation trivia.

## Idempotence and Recovery

Explain which steps are safe to repeat and how to recover from partial changes. If storage or service-worker state can become stale, include the cleanup path.

## Artifacts and Notes

Include concise evidence such as short command output, cache names, or a small DOM/state example that proves the change.

## Interfaces and Dependencies

Name the files, functions, storage keys, and browser APIs involved. Be explicit about the final shape that should exist when the milestone is complete.
```

## Final Standard

An ExecPlan is good enough only when a new contributor can read it in isolation, make the right edits in the right files, run the right commands, and verify a working outcome without asking for missing context.
