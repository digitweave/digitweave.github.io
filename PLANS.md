# DigitWeave execution plans

An ExecPlan is a living Markdown document kept in the repository for
substantial work. It describes the outcome, how to get there, and how to
verify it. Write it so a new contributor can resume with the working tree
and the plan alone.
[AGENTS.md](AGENTS.md) defines when DigitWeave requires an ExecPlan and lists
the repository's validation commands.

## Start a plan

- Inspect the current code, relevant instructions, and existing changes.
  Create or update `docs/exec-plans/EXECPLAN-<task>.md` before implementation.
  Keep completed plans in the same directory for future reference.
- Describe the observable outcome, task boundaries, compatibility
  constraints, and important assumptions. Point to repository-relative
  paths and relevant symbols. Define unfamiliar project terms in context.
- Break the work into independently verifiable milestones. For each one,
  identify its dependencies, affected files or interfaces, commands or
  browser actions, and expected results. Put a small reproduction or
  experiment first when the next decision depends on an unknown.
- When delegating, identify independent work and write ownership. Give
  subagents the relevant milestone and acceptance criteria. The lead
  integrates their findings, reconciles changes, and verifies the result.

Codex's `/plan` can help explore a design. A session checklist or a user-set
`/goal` can help track execution when supported. Keep the durable task state
in the ExecPlan so a fresh session can continue using different tools.

## Maintain and resume a plan

- Update **Progress** after milestones and before a pause or handoff. Use
  checkboxes, timestamp completed steps in UTC, and split partial work into
  completed and remaining items. Put the next runnable step and any blocker
  in the plan.
- Keep **Surprises and discoveries** for facts that affect the work. Include
  brief evidence such as a file and symbol, a command result, or browser
  observations.
- Keep a **Decision log** of material decisions with the date, author, and
  reason. Update milestones and acceptance criteria when a decision changes
  the approach.
- Record the result in **Outcomes and retrospective**. Include actual checks
  and results, unresolved work, and relevant lessons. Keep summaries and
  evidence in the plan or point to durable repository artifacts.
- On resume, compare the plan with the working tree, confirm the current
  milestone and blockers, and continue from the first remaining step.

## Verify the outcome

Write acceptance criteria a contributor can reproduce. State the working
directory for commands, how to start any local server, and what output or
browser behavior to expect. Where practical, reproduce a reported failure
before changing code and repeat the same check afterward.

Use the checks in [AGENTS.md](AGENTS.md) that match the change and add
task-specific verification. For DigitWeave, consider the relevant gameplay
flows, narrow and wide layouts, existing saves and migration, and service
worker cache upgrades and offline behavior. For storage or caching checks,
describe the initial state and how to repeat the check with disposable browser
data. Record any check you could not run as pending or blocked, with the
reason. Record syntax, HTTP, and real browser results as separate evidence.

## Write in Markdown

Use sentence-case headings, one blank line after headings and before lists,
and fenced blocks for commands. Keep prose concise and include only detail
needed to execute or verify the task. A standalone plan is a normal
Markdown file.

## ExecPlan template

Copy this template into `docs/exec-plans/` for a new task. Expand the
milestones where the work needs more detail.

````markdown
# <Action-oriented task title>

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

Describe what will be observable when the work is complete. State the scope,
compatibility constraints, and how to tell when the task is done.

## Progress

- [x] (YYYY-MM-DD HH:MM UTC) Replace with an actual completed step.
- [ ] Describe the next actionable step.

## Surprises and discoveries

Record material findings and the evidence behind them as they emerge.

## Decision log

Record material decisions with the date, author, and reason.

## Context and milestones

Describe the relevant current behavior, files, symbols, and interfaces.
For each milestone, give the changes in execution order, any dependencies
or assignments, and the observable checkpoint.

## Validation and recovery

List checks with their working directory, exact commands or browser steps,
and expected results. Describe setup, retry, and recovery where relevant.

```sh
# Insert the task's commands here.
```

## Outcomes and retrospective

Summarize the delivered behavior and the checks actually run. Note evidence,
remaining work, and lessons relevant to future changes.
````
