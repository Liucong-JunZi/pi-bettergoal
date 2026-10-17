# pi-bettergoal

[中文](#中文) · [English](#english)

> **⚠️ 冲突 / Conflict:** `pi-bettergoal` 与 [`pi-goal`](https://github.com/Michaelliv/pi-goal) 注册相同的 `/goal` 命令及工具，**不能同时启用**。安装前请卸载或禁用原包。 Both packages register the same commands and tools. **Do not enable them together.** Remove or disable upstream first.

- 本仓库 / Repository: https://github.com/Liucong-JunZi/pi-bettergoal
- 上游基础 / Based on: https://github.com/Michaelliv/pi-goal (MIT, based on npm version 0.1.7)
- npm: https://www.npmjs.com/package/@liucong233333/pi-bettergoal
- npm 包名 / Package name: `@liucong233333/pi-bettergoal`（npm 近似名称保护要求使用 scope / scoped name required by npm similar-name protection）

## 验证截图 / Verification screenshots

以下是浏览器对真实测试输出及真实 Kaggle/会话记录报告的截图，**不是 Pi TUI 界面截图**。These are browser screenshots of actual verification reports, not simulated Pi UI.

![Nine lifecycle tests passing](https://raw.githubusercontent.com/Liucong-JunZi/pi-bettergoal/main/docs/screenshots/tests.png)

![Real Kaggle completion and automatic wake evidence](https://raw.githubusercontent.com/Liucong-JunZi/pi-bettergoal/main/docs/screenshots/kaggle-wake.png)

## 中文

为 [Pi](https://pi.dev) 提供持久化目标，以及**模型自主挂起、条件满足后自动唤醒**。等待后台任务时不再反复发送 Continue，不消耗等待期间的模型调用。

这是基于 **Michaelliv/pi-goal** 的增强版本，不是上游官方发行版。保留原作者署名与 MIT 许可证。当前针对 `@earendil-works` Pi 运行时；未验证旧版 `@mariozechner` 运行时。

### 安装

先卸载原包（或在 Pi 配置中禁用其全部扩展和 skills）：

```sh
pi remove npm:pi-goal
pi install npm:@liucong233333/pi-bettergoal
```

如果原包通过 git 或本地路径安装，请移除对应来源，而不是只执行上面的 npm 移除命令。**个人级和项目级配置都不能重复加载两个包**。安装后执行 `/reload`。安装本身不会启动目标或后台任务。

也可以从本仓库安装：

```sh
pi install git:github.com/Liucong-JunZi/pi-bettergoal
```

### 使用

```text
/goal --tokens 50k 实现功能并验证验收测试
/goal status
/goal pause
/goal resume
/goal clear
/goal statusbar off
```

模型只在用户明确要求目标模式时创建目标。完成前必须核查实际证据；遇到外部阻塞时，可调用新的 `wait_goal`，而不是冒用完成状态来停止。

```text
active → wait_goal → waiting → 匹配 hook → active
                           → 超时/错误 → paused
active → 验证目标完成 → complete
```

以下是模型工具参数示例，不是 shell 命令：

```json
{"kind":"file","path":"/tmp/unique-job/completed.json","reason":"等待后台任务写入独立完成回执","seconds":43200}
```

支持：文件出现/元数据变化、定时器、相关联的扩展事件、人工恢复。文件检查间隔 5 秒，不调用模型、shell 或网络。扩展事件必须匹配目标 ID、等待 ID 和事件名。

**唤醒只代表需要检查结果，不代表任务成功。** 本包不自带 Kaggle 监控，也不启动 HTTP webhook 服务。需要独立且获授权的后台进程写完成文件，或扩展发送事件。

### 安全边界

- 用户暂停、清除、替换目标、预算耗尽或退出会取消 hook。
- 旧事件不能唤醒新的等待；忙碌期间收到事件会暂存，空闲后唤醒一次。
- reload、重启恢复和分支导航不会自动继续原等待目标。
- 文件/事件等待到期会暂停，不唤醒模型；单次等待最长 7 天。
- 不绕过用户授权；没有全局语义空转检测，建议需要时设置 token 预算。

已通过真实 CPU-only Kaggle 本子 → 有界后台监控 → 完成文件 → 模型挂起/自动唤醒测试。它不是正式比赛评分测试，也不证明重启后能持续监控。

### 参数与排障

| 参数 | 说明 |
|---|---|
| `reason` | 必填，描述具体阻塞和期待证据 |
| `kind` | `file`、`time`、`event` 或 `manual` |
| `seconds` | 1–604800；文件/事件默认 86400，人工默认 604800；定时器建议显式提供 |
| `path` | 文件等待路径，支持相对当前工作目录或绝对路径 |
| `fileMode` | `exists`（默认）或 `changed`；changed 是元数据变化，不是语义内容比较 |
| `event` | 扩展事件名，事件等待时必填 |

- 工具未出现：执行 `/reload`，确认只启用一个 goal 包；`wait_goal` 仅在目标 active 时可见。
- 任务完成却未唤醒：确认 Pi 进程仍运行、路径正确、等待未过期，或事件携带正确的三个匹配字段。
- `exists` 请使用每次运行独立的回执路径，避免旧文件误触发。唤醒后仍需核对回执身份与实际结果。
- 回退：卸载 `npm:@liucong233333/pi-bettergoal` 后重新安装 `npm:pi-goal`，然后 `/reload`；不要同时启用。

详细 API、事件生产者协议和限制见 [HOOKS.md](HOOKS.md)。

## English

Persistent goals for [Pi](https://pi.dev) with **model-selected suspension and condition-driven wake-up**. Avoid repeated continuation turns while blocked on an external job.

This is an independent MIT-licensed enhancement built on [Michaelliv/pi-goal](https://github.com/Michaelliv/pi-goal), based on npm version 0.1.7, not an official upstream release. Original attribution is preserved. Targets the `@earendil-works` Pi runtime; not tested with the older `@mariozechner` runtime.

### Installation and conflicts

**Remove or disable upstream pi-goal before enabling this package.** Both register `/goal`, `create_goal`, `get_goal`, and `update_goal`. Loading both is unsupported; this package additionally registers `wait_goal`.

```sh
pi remove npm:pi-goal
pi install npm:@liucong233333/pi-bettergoal
```

If upstream was installed from git or a local path, remove that source instead. Check both personal and project settings for duplicate loading. Run `/reload` after changing packages. Installation does not start a goal or a background job.

Alternatively:

```sh
pi install git:github.com/Liucong-JunZi/pi-bettergoal
```

### Usage

```text
/goal --tokens 50k implement the feature and verify acceptance tests
/goal status
/goal pause
/goal resume
/goal clear
```

The model creates goals only when explicitly requested and completes them only after an evidence-based audit. `wait_goal` suspends an active goal without falsely declaring success.

```text
active -> wait_goal -> waiting -> matching hook -> active
                              -> expiry/error -> paused
active -> verified completion -> complete
```

Example model-facing arguments, not shell commands:

```json
{"kind":"time","seconds":600,"reason":"Wait for the authorized cooldown"}
```

```json
{"kind":"event","event":"job-123.complete","reason":"Wait for the worker extension","seconds":43200}
```

```json
{"kind":"manual","reason":"Need user authorization before proceeding"}
```

File waits inspect local metadata every five seconds without LLM, shell or network calls. Event producers emit `goal:wake` via `pi.events` with the exact `goalId`, `waitId`, and event name returned by `wait_goal`. See [HOOKS.md](HOOKS.md) for the full contract.

A completion signal means **inspect the result**, not assume success. This package neither installs a Kaggle watcher nor opens an HTTP webhook endpoint. Use a separately authorized worker or extension.

### Lifecycle and safety

- Waiting is not completion and does not queue continuation prompts.
- Pause, clear, replacement, budget exhaustion and shutdown cancel hooks.
- Stale/mismatched event IDs are ignored; busy-time readiness is latched for one wake after idle.
- Reload/session restore pauses waiting goals. Branch navigation pauses restored active/waiting goals.
- File/event expiry pauses without waking the model; each wait is bounded to seven days.
- No semantic no-progress detector or global cap on repeated waits; use an explicit token budget when required.

### Troubleshooting

Run `/reload` after installation and ensure upstream pi-goal is disabled in both personal and project settings. `wait_goal` is visible only for active goals. Pi must remain running for timers/watchers to operate. Use a unique receipt path per job: `exists` does not validate file contents, and `changed` includes deletion/metadata changes. On wake, verify job identity and result. To roll back, remove this package, reinstall upstream, and reload; never enable both together.

### Development / 开发

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run check  # requires Pi on PATH; loader smoke check, no model call
npm pack --dry-run
```

Nine tests mock the terminal UI and scheduler while exercising actual extension handlers. A real CPU-only Kaggle run also completed cloud execution -> bounded worker -> receipt -> automatic wake. [Live test audit](test/evidence/kaggle-wake-9d7b6ecda56b/AUDIT.md) (source checkout only). Test evidence, private session transcripts, credentials and local settings are excluded from the npm archive.

## License / 许可证

[MIT](LICENSE). Original pi-goal author: Michaelliv. Hook integration and verification: Liucong-JunZi. Original copyright notice is preserved.
