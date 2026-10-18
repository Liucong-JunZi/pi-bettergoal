# pi-bettergoal

[English](README.md) | **简体中文**

为 [Pi](https://pi.dev) 提供持久化目标，以及**模型自主挂起、条件满足后自动唤醒**。等待外部任务时，不必反复发送“继续”，等待期间本身不消耗模型调用。

## 在线安装（推荐）

> **冲突提醒：** `pi-bettergoal` 与 [`pi-goal`](https://github.com/Michaelliv/pi-goal) 注册相同的 `/goal` 命令和目标工具，**不能同时启用**。请先移除或禁用原包。

```sh
# 如果原 pi-goal 通过 npm 安装，先移除它。
pi remove npm:pi-goal
pi install npm:@liucong233333/pi-bettergoal
```

然后在 Pi 中执行 `/reload`。如果原包通过 git 或本地路径安装，请移除对应来源。检查**个人级和项目级配置**，避免重复加载。安装本身不会启动目标或后台任务。

也可以直接从 GitHub 安装：

```sh
pi install git:github.com/Liucong-JunZi/pi-bettergoal
```

需要兼容的 Pi 运行时和 Node.js 20+。当前针对 `@earendil-works` Pi 运行时；未验证旧版 `@mariozechner` 运行时。

**相关链接：** [npm](https://www.npmjs.com/package/@liucong233333/pi-bettergoal) · [GitHub Releases](https://github.com/Liucong-JunZi/pi-bettergoal/releases) · [Hook API](HOOKS.md) · [上游 pi-goal](https://github.com/Michaelliv/pi-goal)

## 快速使用

```text
/goal --tokens 50k 实现功能并验证验收测试
/goal status
/goal pause
/goal resume
/goal clear
/goal statusbar off
```

模型**只在用户明确要求目标模式时**创建目标，并且必须核查实际证据后才能宣布完成。遇到外部任务阻塞时，`wait_goal` 可以挂起当前目标，而不是冒用完成状态来停止。

```text
active → wait_goal → waiting → 匹配 hook → active
                           → 超时/错误 → paused
active → 验证目标完成 → complete
```

### 等待外部任务

下面是模型调用 `wait_goal` 的参数示例，**不是 shell 命令**：

```json
{"kind":"file","path":"/tmp/unique-job/completed.json","reason":"等待后台任务写入独立完成回执","seconds":43200}
```

每次任务应使用**独立的回执路径**，避免旧文件误触发。回执需要由独立且获授权的后台进程写入；本包不会替你启动这个进程。

也支持以下等待方式：

```json
{"kind":"time","seconds":600,"reason":"等待已获授权的冷却时间结束"}
```

```json
{"kind":"event","event":"job-123.complete","reason":"等待工作扩展发出完成事件","seconds":43200}
```

```json
{"kind":"manual","reason":"需要用户授权后才能继续"}
```

文件检查间隔为 5 秒，不调用模型、shell 或网络。扩展事件通过 `pi.events` 发送 `goal:wake`，必须精确匹配 `wait_goal` 返回的 `goalId`、`waitId` 和事件名。完整协议见 [HOOKS.md](HOOKS.md)。

**唤醒只代表需要检查结果，不代表任务成功。** 本包不自带 Kaggle 监控，也不启动 HTTP webhook 服务。请使用独立且获授权的后台进程或扩展。

## 模型可调用的目标操作

| 工具 | 作用 |
|---|---|
| `create_goal` | 用户明确要求时创建/替换目标 |
| `get_goal` | 查看任意状态，包括 waiting/paused，不会恢复执行 |
| `wait_goal` | 登记文件/定时器/事件/人工等待 |
| `pause_goal` | 暂停、取消 hook，不标记完成 |
| `resume_goal` | 用户明确授权后恢复等待/暂停目标 |
| `clear_goal` | 用户明确要求时清除目标并取消 hook |
| `achieve_goal` | 证据审计后完成，参数 `status: "complete"` |
| `update_goal` | 保留兼容的完成工具 |
| `set_goal_statusbar` | 用 `enabled` 布尔值控制状态栏 |

查看、暂停、恢复、清除、状态栏工具在 waiting/paused 时仍可用，无需强制用户输入斜杠命令。暂停/恢复/清除需要具体 `reason`。完成和等待工具仅在 active 时显示。恢复会取消原等待，不重启旧监控；已完成或耗尽 token 预算的目标不能恢复。

自动 Continue 和无关聊天不是恢复授权。明确授权是模型行为规则，不是强制人工确认弹窗。完成工具不自动验证证据，仍由模型执行完成审计。

## 生命周期与安全边界

- 等待不是完成，也不会排队发送继续提示。
- 用户暂停、清除、替换目标、预算耗尽或退出会取消 hook。
- 旧事件或不匹配的事件不能唤醒新的等待；忙碌期间收到的就绪信号会暂存，空闲后唤醒一次。
- reload 和会话恢复会暂停等待中的目标；分支导航会暂停恢复的 active 或 waiting 目标。
- 文件/事件等待到期会暂停，不唤醒模型；单次等待最长 7 天。
- 不绕过用户授权；没有语义空转检测或重复等待的全局次数限制，建议需要时显式设置 token 预算。

### 监控清理机制

插件的监听运行在 Pi 进程内部，不是独立进程。离开 waiting 状态时会清除轮询定时器和事件订阅；会话退出、切换和分支导航也会撤销 hook。定时器使用 `unref`，不会单独阻止 Node.js 退出。人工等待不启动监听器。

**插件不负责管理或终止外部后台进程。** 暂停目标或退出 Pi，不会终止另行启动的监控进程；外部进程需要自行设置完成/失败退出、超时和取消策略。仓库中的 Kaggle 测试监控脚本在成功或终止性失败后退出，最多检查 40 次、间隔 30 秒，状态查询和下载命令分别设置 35/90 秒超时。这只是该测试脚本的行为，不代表任意外部进程都受此约束。

如果 Pi 忙碌时已经观察到就绪信号，插件会保留信号并等待空闲后唤醒，原截止时间不会丢弃已经观察到的信号；显式取消仍会清理 hook。

## 等待参数

| 参数 | 说明 |
|---|---|
| `reason` | 必填，描述具体阻塞和期待证据。 |
| `kind` | `file`、`time`、`event` 或 `manual`。 |
| `seconds` | 1–604800；文件/事件默认 86400，人工默认 604800；定时器建议显式提供。 |
| `path` | 文件等待路径，支持绝对路径或相对当前工作目录的路径。 |
| `fileMode` | `exists`（默认）或 `changed`；后者检查元数据变化，不是语义内容比较。 |
| `event` | 扩展事件名，事件等待时必填。 |

## 离线安装

[GitHub Releases](https://github.com/Liucong-JunZi/pi-bettergoal/releases) 提供独立离线 ZIP、npm 格式 TGZ 和 `SHA256SUMS` 校验文件。

1. 在联网机器下载 `pi-bettergoal-0.3.0-offline.zip` 和 `SHA256SUMS`，复制到目标机器。
2. 核对 `SHA256SUMS` 中 ZIP 对应的校验行。如果已下载全部列出的文件，可执行 `shasum -a 256 -c SHA256SUMS` 一起校验。
3. 解压后，以绝对路径安装：

```sh
unzip pi-bettergoal-0.3.0-offline.zip -d "$HOME/pi-extensions"
pi install "$HOME/pi-extensions/pi-bettergoal-0.3.0"
```

先移除或禁用原 `pi-goal`，安装后执行 `/reload`。目标机器需已安装兼容的 Pi 和 Node.js；插件运行无额外 npm 依赖，不需要执行 `npm install`。**请保留解压目录**，Pi 从该路径加载插件。

离线指插件安装不需要访问注册表，不代表模型推理也能离线。TGZ 用于 npm 兼容分发；不访问注册表的 Pi 安装请使用 ZIP 与本地路径方式。

## 排障

- **工具未出现：** 执行 `/reload`，确认只启用一个 goal 包；`wait_goal` 仅在目标 active 时可见。
- **任务完成却未唤醒：** 确认 Pi 进程仍在运行、回执路径正确、等待未过期；事件等待还需检查三个匹配字段。
- **文件意外触发唤醒：** `exists` 不验证文件内容，`changed` 包括删除及元数据变化。请使用独立路径，并在唤醒后核对任务身份与实际结果。
- **回退到上游：** 卸载 `npm:@liucong233333/pi-bettergoal`，重新安装 `npm:pi-goal`，然后执行 `/reload`；不要同时启用。

## 开发与验证

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run check  # 需要 PATH 中有 Pi；仅检查扩展加载，不调用模型
npm pack --dry-run
```

12 个测试通过模拟终端 UI 与调度器来验证实际扩展处理器。另已通过真实 CPU-only Kaggle 本子 → 有界后台监控 → 完成文件 → 模型自动唤醒测试。参见[实际测试审计](test/evidence/kaggle-wake-9d7b6ecda56b/AUDIT.md)（仅源码仓库包含）。它不是正式比赛评分测试，也不证明重启后能持续监控。

测试证据、私有会话记录、凭据和本地配置不包含在 npm 包中。

## 来源与许可证

这是基于 [Michaelliv/pi-goal](https://github.com/Michaelliv/pi-goal) npm 0.1.7 的独立增强版本，**不是上游官方发行版**。

[MIT](LICENSE)。原 pi-goal 作者：Michaelliv。Hook 集成与验证：Liucong-JunZi。保留原作者署名和版权声明。
