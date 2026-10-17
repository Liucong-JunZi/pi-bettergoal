# Hook-enabled local fork (upstream pi-goal 0.1.7, MIT)

## Installation

Load this package instead of npm:pi-goal, never both. Personal settings may reference the absolute local directory. Run /reload in Pi after switching. The currently running extension is not modified by editing settings. Original npm package remains untouched; revert the settings package source to npm:pi-goal to roll back.

This fork targets @earendil-works Pi APIs (including tool terminate:true). It does not modify the model or run outside Pi. No project .pi directory is needed.

## State machine

active -> wait_goal -> waiting -> matched hook -> active
waiting -> deadline/error -> paused
waiting -> user pause/clear/replace -> cancelled
waiting -> reload/session restore -> paused (hooks discarded)
active -> verified completion -> complete

wait_goal is exposed only while active, separate from update_goal(complete). A call persists the wait condition and returns terminate:true. agent_end no longer schedules continuations while waiting. The current turn's usage is still accounted; crossing the token budget cancels waiting and marks budget_limited. Unrelated user turns during waiting are not goal usage.

User pause/clear/replace, session shutdown, session switch, branch navigation and reload clean timers and bus subscriptions. Branch navigation pauses a restored active/waiting goal. /goal resume explicitly resumes work, not the previous watcher. A manual wait starts no watcher. File/event waits expire by default after 24 hours; time waits wake after the supplied seconds. seconds is bounded to 1..604800. No sleep survives process exit; restored waiting goals pause rather than silently rearm.

## Model-facing examples (not commands for a shell)

Wait for a background worker's dedicated completion receipt:

```json
{"reason":"Experiment worker must finish and write its receipt before analysis","kind":"file","path":"/tmp/my-run-unique/completed.json","fileMode":"exists","seconds":43200}
```

Use a unique path per run. exists only checks existence, not JSON validity or job success. changed compares filesystem metadata (device/inode/size/mtime/ctime), not semantic file content. A deletion also counts as changed. Always inspect actual results after waking. Avoid watching broad noisy logs as a completion proxy. Metadata is checked every 5 seconds without LLM requests, shell commands or network calls.

```json
{"reason":"Retry after the authorized cooldown","kind":"time","seconds":600}
```

```json
{"reason":"Need user authorization; no background action is permitted","kind":"manual"}
```

## Extension event integration

```json
{"reason":"Wait for job-123 completion","kind":"event","event":"job-123.complete","seconds":43200}
```

The tool response includes goalId and wait.id. The producer extension must be configured with BOTH IDs, then can emit:

```ts
pi.events.emit("goal:wake", {
  goalId: "<exact current goalId>",
  waitId: "<exact current wait.id>",
  event: "job-123.complete",
});
```

Wrong/stale IDs or names are ignored. The event payload is not inserted as model instructions. A signal received during a busy user turn is latched and delivered once after idle and no pending messages. Pause or clear before delivery cancels it. This is an in-process trusted extension bus, not an authenticated remote webhook endpoint. No HTTP server is opened; no arbitrary shell hook or Kaggle polling is installed. A separate authorized worker can use file receipts, or an extension can use the event bus.

## Verification boundaries

Nine automated tests exercise the actual extension registration and handlers using a mock Pi API and fake scheduler, plus pure condition tests: no waiting continuation; terminate result; final-turn accounting; correlated one-shot wake; busy latching and cancellation; clear/replace/reload/shutdown/session-switch/branch-navigation cleanup; local file readiness/expiry; manual resume and budget handling. They do not establish actual live-session reload or remote job completion. A Pi extension-load smoke check separately tests real loader compatibility; after /reload, use a disposable goal for live end-to-end checks.

Run tests with npm install --ignore-scripts --legacy-peer-deps followed by npm test in a standalone checkout, or provide the installed Pi host node_modules through NODE_PATH. Never start a real goal in production merely to run unit tests.

## Preventing runaway waiting

The model should use manual wait when permission or a human decision is missing, rather than repeatedly scheduling timers. Hooks do not grant permission to poll services or start experiments. A time wake is a real opportunity to re-evaluate, not evidence of completion. This implementation bounds each wait but not the number of model-selected waits across the goal lifetime; use an explicit user token budget when a global spending limit is needed. No-op semantic detection is not implemented.
