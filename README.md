# pi-bettergoal

**English** | [简体中文](README.zh-CN.md)

Persistent goals for [Pi](https://pi.dev) with **model-selected suspension and condition-driven wake-up**. Stop sending repeated “continue” prompts while waiting for an external job—waiting itself makes no model calls.

## Online installation (recommended)

> **Conflict:** `pi-bettergoal` and [`pi-goal`](https://github.com/Michaelliv/pi-goal) register the same `/goal` command and goal tools. **Do not enable both.** Remove or disable upstream pi-goal before installing.

```sh
# If upstream pi-goal was installed from npm, remove it first.
pi remove npm:pi-goal
pi install npm:@liucong233333/pi-bettergoal
```

Then run `/reload` in Pi. If upstream was installed from git or a local path, remove that source instead. Check **both personal and project settings** for duplicate loading. Installation does not start a goal or a background job.

Alternatively, install directly from GitHub:

```sh
pi install git:github.com/Liucong-JunZi/pi-bettergoal
```

Requires a compatible Pi runtime and Node.js 20+. This package targets the `@earendil-works` Pi runtime; the older `@mariozechner` runtime has not been tested.

**Links:** [npm](https://www.npmjs.com/package/@liucong233333/pi-bettergoal) · [GitHub Releases](https://github.com/Liucong-JunZi/pi-bettergoal/releases) · [Hook API](HOOKS.md) · [Upstream pi-goal](https://github.com/Michaelliv/pi-goal)

## Quick start

```text
/goal --tokens 50k implement the feature and verify acceptance tests
/goal status
/goal pause
/goal resume
/goal clear
/goal statusbar off
```

The model creates goals **only when explicitly requested** and completes them only after an evidence-based audit. When blocked on an external job, `wait_goal` suspends an active goal without falsely declaring success.

```text
active -> wait_goal -> waiting -> matching hook -> active
                              -> expiry/error -> paused
active -> verified completion -> complete
```

### Waiting for an external job

Example model-facing `wait_goal` arguments—not shell commands:

```json
{"kind":"file","path":"/tmp/unique-job/completed.json","reason":"Wait for the worker's unique completion receipt","seconds":43200}
```

Use a **unique receipt path per job** to avoid triggering on an old file. A separately authorized background worker must produce the receipt; this package does not launch the worker for you.

Other supported wait types:

```json
{"kind":"time","seconds":600,"reason":"Wait for the authorized cooldown"}
```

```json
{"kind":"event","event":"job-123.complete","reason":"Wait for the worker extension","seconds":43200}
```

```json
{"kind":"manual","reason":"Need user authorization before proceeding"}
```

File waits inspect local metadata every five seconds without model, shell or network calls. Event producers emit `goal:wake` via `pi.events` with the exact `goalId`, `waitId`, and event name returned by `wait_goal`. See [HOOKS.md](HOOKS.md) for the full contract.

**A wake-up means inspect the result, not assume success.** This package neither installs a Kaggle watcher nor opens an HTTP webhook endpoint. Use a separately authorized worker or extension.

## Model-callable goal operations

| Tool | Operation |
|---|---|
| `create_goal` | Create/replace only on explicit user request |
| `get_goal` | Inspect all states, including waiting/paused; does not resume |
| `wait_goal` | Suspend with file/time/event/manual condition |
| `pause_goal` | Pause and cancel hooks, without marking complete |
| `resume_goal` | Resume waiting/paused goal on explicit user authorization |
| `clear_goal` | Clear on explicit user request and cancel hooks |
| `achieve_goal` | Complete after evidence audit; requires `status: "complete"` |
| `update_goal` | Backward-compatible completion alias |
| `set_goal_statusbar` | Set footer visibility with `enabled` boolean |

All goal tools stay declared for as long as a goal exists, regardless of whether it is active, waiting or paused; only their execution is state-checked. Declarations never flip mid-turn, which previously produced a `tool not found` error right after a state change. `create_goal` and `get_goal` remain declared even without a goal. Pause/resume/clear require a concrete `reason`. Resume cancels the old wait, not restarts its watcher. Completed or token-exhausted goals cannot resume. Automatic Continue messages and unrelated chat are not user authorization. Explicit-authorization rules are model-facing policy, not an enforced human approval dialog. `achieve_goal` and `update_goal` do not assess evidence automatically; the model must audit it.

## Lifecycle and safety

- Waiting is not completion and does not queue continuation prompts.
- Pause, clear, replacement, budget exhaustion and shutdown cancel hooks.
- Stale or mismatched event IDs are ignored; readiness received while busy is saved for one wake after idle.
- Reload and session restore pause waiting goals. Branch navigation pauses restored active or waiting goals.
- File/event expiry pauses without waking the model; each wait is bounded to seven days.
- User authorization is still required. There is no semantic no-progress detector or global cap on repeated waits; use an explicit token budget when required.

### Monitor cleanup

The extension's watcher runs inside Pi, not as a separate process. Leaving the waiting state clears its polling timer and event subscription; session shutdown, switching and branch navigation also disarm hooks. The timer is `unref`'d so it does not keep Node.js alive on its own. Manual waits start no watcher.

**External worker processes are not managed or killed by this extension.** Pausing a goal or exiting Pi does not terminate a separately launched monitor. Such workers need their own completion/error exits, timeouts and cancellation policy. The Kaggle test worker in this repository exits on success or terminal failure, limits itself to 40 checks with 30-second intervals, and gives status/download commands 35/90-second timeouts. This is test-worker behavior, not a guarantee for arbitrary workers.

If readiness is observed while Pi is busy, the extension keeps the signal and waits for idle before waking; the original deadline does not discard an already observed signal. Explicit cancellation still cleans up the hook.

## Wait parameters

| Parameter | Description |
|---|---|
| `reason` | Required; describe the specific blocker and expected evidence. |
| `kind` | `file`, `time`, `event`, or `manual`. |
| `seconds` | 1–604800; file/event default to 86400, manual to 604800. Set explicitly for timers. |
| `path` | File-wait path, absolute or relative to the current working directory. |
| `fileMode` | `exists` (default) or `changed`; the latter checks metadata changes, not semantic content. |
| `event` | Extension event name; required for event waits. |

## Offline installation

[GitHub Releases](https://github.com/Liucong-JunZi/pi-bettergoal/releases) provide a standalone ZIP, an npm-format TGZ, and `SHA256SUMS`.

1. Download `pi-bettergoal-0.3.0-offline.zip` and `SHA256SUMS` on a connected machine, then transfer them to the target machine.
2. Verify the ZIP against its entry in `SHA256SUMS`. If all listed assets are present, run `shasum -a 256 -c SHA256SUMS` to verify them together.
3. Extract and install using an absolute path:

```sh
unzip pi-bettergoal-0.3.0-offline.zip -d "$HOME/pi-extensions"
pi install "$HOME/pi-extensions/pi-bettergoal-0.3.0"
```

Remove or disable upstream pi-goal first, then run `/reload` after installation. The target machine must already have a compatible Pi runtime and Node.js. No additional npm runtime dependencies or `npm install` are needed. **Keep the extracted directory in place**: Pi loads the package from that path.

Offline installation means no registry access is needed to install this extension—not that model inference works offline. The TGZ is supplied for npm-compatible distribution; use the ZIP/local-path method for registry-free Pi installation.

## Troubleshooting

- **Tools missing:** Run `/reload` and ensure only one goal package is enabled. `wait_goal` is visible only for active goals.
- **Job finished but no wake-up:** Pi must remain running. Check the receipt path, wait expiry, or all three matching event fields.
- **Unexpected file wake-up:** `exists` does not validate file contents; `changed` includes deletion and metadata changes. Use unique paths, then verify job identity and actual results after waking.
- **Roll back to upstream:** Remove `npm:@liucong233333/pi-bettergoal`, reinstall `npm:pi-goal`, then run `/reload`. Never enable both together.

## Development and verification

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run check  # requires Pi on PATH; loader smoke check, no model call
npm pack --dry-run
```

Twelve tests mock the terminal UI and scheduler while exercising actual extension handlers. A real CPU-only Kaggle run also completed cloud execution → bounded worker → receipt → automatic wake. See the [live test audit](test/evidence/kaggle-wake-9d7b6ecda56b/AUDIT.md) (source checkout only). This was not an official competition scoring test and does not establish monitoring across restarts.

Test evidence, private session transcripts, credentials and local settings are excluded from the npm archive.

## Attribution and license

An independent enhancement of [Michaelliv/pi-goal](https://github.com/Michaelliv/pi-goal), based on npm version 0.1.7—not an official upstream release.

[MIT](LICENSE). Original pi-goal author: Michaelliv. Hook integration and verification: Liucong-JunZi. Original attribution and copyright notice are preserved.
