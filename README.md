# pi-goal-hooks

Persistent goals for [Pi](https://pi.dev) with **model-selected suspension and event-driven wake-up**. Instead of repeatedly asking an agent to continue while it is blocked, let it wait without LLM calls until evidence arrives.

MIT-licensed fork of [Michaelliv/pi-goal](https://github.com/Michaelliv/pi-goal), based on version 0.1.7. Targets the `@earendil-works` Pi runtime. Not tested with the older `@mariozechner` runtime.

## Install

When published on npm:

```sh
pi install npm:pi-goal-hooks
```

For a local checkout:

```sh
pi install /absolute/path/to/pi-goal-hooks
```

Remove/disable upstream `npm:pi-goal` first: both packages register the same commands and tools. Run `/reload` after changing packages. No project `.pi/` directory is needed. Installation alone does not start a goal or background job.

## Usage

```text
/goal --tokens 50k implement the feature and verify its acceptance tests
/goal status
/goal pause
/goal resume
/goal clear
/goal statusbar off
```

The model can create a goal only on an explicit user request, read the active goal, mark it complete after an evidence-based audit, or suspend it with `wait_goal`.

```text
active -> wait_goal -> waiting -> matching hook -> active
                              -> expiry/error -> paused
active -> verified completion -> complete
```

### Wake conditions

The following are model-facing tool arguments, not shell commands:

```json
{"kind":"file","path":"/tmp/unique-job/completed.json","reason":"Wait for the worker's completion receipt","seconds":43200}
```

```json
{"kind":"time","seconds":600,"reason":"Wait for the authorized cooldown"}
```

```json
{"kind":"event","event":"job-123.complete","reason":"Wait for the worker extension","seconds":43200}
```

```json
{"kind":"manual","reason":"Need user authorization before proceeding"}
```

File waits check local filesystem metadata every five seconds; they make no model or network calls. An event producer emits `goal:wake` through `pi.events`, including the exact `goalId`, `waitId`, and event name returned by `wait_goal`. See [HOOKS.md](HOOKS.md) for the producer contract, defaults, cancellation, and limitations.

A completion signal means **inspect the result**, not assume success. Waiting does not grant permission to poll services or perform new actions. This package does not install a Kaggle watcher or expose an HTTP webhook server.

## Safety and lifecycle

- Waiting is distinct from completion and does not queue continuation prompts.
- User pause, clear, replacement, budget exhaustion, and shutdown cancel hooks.
- Stale or mismatched event IDs cannot wake another wait.
- Busy-time events latch until idle, with one wake per wait.
- Reload/session restore pauses waiting goals; timers do not survive process exit.
- File/event timeout pauses without waking the model; each wait is bounded to seven days.
- A global token budget is optional; there is no semantic no-progress detector or global limit on repeated waits.

## Development

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run check  # requires Pi on PATH; extension-loader smoke check, no model call
npm pack --dry-run
```

Tests mock the terminal UI and scheduler; they verify actual registered lifecycle/tool handlers but are not a replacement for a live end-to-end test. A real CPU-only Kaggle notebook test also completed the cloud -> bounded background worker -> local receipt -> waiting goal -> automatic wake chain. See [the audit](test/evidence/kaggle-wake-9d7b6ecda56b/AUDIT.md) in the source checkout. Test evidence, private session transcripts, credentials and local settings are excluded from the npm archive.

## License and attribution

[MIT](LICENSE). Original pi-goal author: Michaelliv. Hook integration and local verification: Liucong-JunZi. Original copyright notice is preserved.
