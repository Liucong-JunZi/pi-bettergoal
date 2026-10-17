# Live Kaggle -> background monitor -> goal wake audit

User request: push a Kaggle notebook and automatically wake this agent after completion.

| Requirement | Actual evidence | Outcome |
|---|---|---|
| Real notebook push | push.log: version 1 successfully pushed, smartorz/pi-goal-wake-9d7b6ecda56b | Pass |
| Cloud computation finishes | finished.json status checks: RUNNING then COMPLETE; output log prints receipt after 20-second sleep | Pass |
| Retrieve real output, not status alone | download.json exit 0; output/wake-receipt.json token equals plan.json token and completed=true | Pass |
| Model actually suspends | session-wake-evidence.json: waiting at 2026-10-17T12:56:27.439Z; wait tool baseline missing | Pass |
| Completion automatically wakes | file ready and active persisted at 12:56:52.445/446Z; exactly one resumed event; subsequent model read of finished.json | Pass |
| No repeated Continue turns while waiting | session entries between waiting and readiness contain waiting/accounting then readiness, no intervening continuation/resumed event | Pass |
| Bounded monitoring | watch-process.json and watch.py: max40 checks, 30s interval, status35s timeout/download90s timeout; actual two status checks, 50.4s monitor lifetime | Pass |

Waiting interval approximately 25 seconds; this is not total cloud startup duration. Watcher observed RUNNING then COMPLETE; local monitor was started after upload. The notebook is CPU-only and not a competition submission. Receipt matching proves this unique smoke run, not official competition scoring. Waking uses a local completion file produced by an authorized background worker; it is not a direct Kaggle webhook. Does not test persistence across restart or other wait kinds in a live session. No need to run further notebooks for this objective.

The first evidence-extraction command incorrectly looked for goal messages inside message entries and failed an assertion. Pi persists these as custom_message entries; corrected parsing verifies the resumed event. This was an audit script error, not failure of the wake hook.
