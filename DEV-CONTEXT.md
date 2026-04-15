# OpenClaw 便携工具箱 — 开发上下文

## 项目目标

为 Windows / Linux / macOS 提供完全便携的 OpenClaw AI 助手网关工具箱。
所有组件均安装在项目目录内，不依赖系统环境，不污染系统 PATH。

---

## 架构分工

| 层 | 文件 | 职责 |
|----|------|------|
| 平台入口 | `OpenClaw.bat` / `openclaw.sh` | 启动菜单 |
| 命令行入口 | `claw.bat` / `claw.sh` | 透传 openclaw 命令 |
| Node.js 安装 | `win/Ensure-NodeJS.ps1` / `unix/ensure-nodejs.sh` | 自动下载便携 Node.js |
| git 安装 | `scripts/ensure-git.js` | Windows 自动下载 MinGit |
| 业务逻辑 | `scripts/*.js` | 跨平台，所有菜单功能 |

---

## scripts/env.js 全局变量

| 变量 | 说明 |
|------|------|
| `OC_ROOT` | 项目根目录 |
| `OC_NODE` | node 可执行文件完整路径 |
| `OC_NODE_DIR` | node 所在目录 |
| `OC_NODE_READY` | Node.js 是否就绪 |
| `OC_NPM_CLI` | npm-cli.js 路径 |
| `OC_OPENCLAW_MJS` | openclaw.mjs 路径 |
| `OC_OPENCLAW_VER` | openclaw 版本号 |
| `OC_OPENCLAW_READY` | openclaw 是否已安装（shim + mjs 均存在） |
| `OC_HOME` | `OC_ROOT/openclaw-data` |
| `OC_OPENCLAW_DIR` | `OC_HOME/.openclaw` |
| `OC_CONFIG` | `OC_HOME/.openclaw/openclaw.json` |

---

## 菜单功能状态

| 编号 | 功能 | 脚本 | 状态 |
|------|------|------|------|
| [1] | Node.js 环境信息 | scripts/init-nodejs.js | ✅ |
| [2] | OpenClaw 安装/检测 | scripts/install-openclaw.js | ✅ |
| [3] | OpenClaw 运行状态 | scripts/status.js | ✅ |
| [4] | 启动/停止 Gateway | scripts/toggle.js | ✅ |
| [5] | 一键清除 | scripts/clear-all.js | ✅ |
| [6] | 重新配置 | scripts/reconfigure.js | ✅ |

---

## 关键设计约定

1. 所有 `scripts/*.js` 头部 `require('./env.js')`
2. 调用 npm 必须用 `node npm-cli.js ...`，不能用 `npm.cmd`（含特殊字符路径下失效）
3. 调用 openclaw 用 `node openclaw.mjs ...`，不用 `.cmd` shim
4. `OC_OPENCLAW_READY` 同时检查 shim 和 `openclaw.mjs` 是否存在
5. 配置完整性以 `auth-profiles.json` 是否存在为判断依据（不依赖 `openclaw.json`）
6. Windows PS1 文件保存为 UTF-8 BOM，Shell 脚本保存为 LF 换行

---

## openclaw 配置文件说明

### openclaw.json（主配置）

```
openclaw-data/.openclaw/openclaw.json
```

关键字段：
- `gateway.auth.token` — Dashboard 访问 token
- `agents.defaults.provider` — 默认 AI provider（必须与 auth-profiles.json 一致）
- `agents.defaults.model` — 默认模型 ID
- `agents.defaults.workspace` — Agent 工作区路径（绝对路径，迁移后自动修正）
- `channels.telegram.botToken` — Telegram bot token
- `channels.telegram.dmPolicy` — DM 策略（`pairing` / `allowlist`）

### auth-profiles.json（AI provider 认证）

```
openclaw-data/.openclaw/agents/main/agent/auth-profiles.json
```

格式：
```json
{
  "version": 1,
  "profiles": {
    "openrouter:default": {
      "type": "api_key",
      "provider": "openrouter",
      "key": "sk-or-v1-..."
    }
  }
}
```

### models.json（模型配置）

```
openclaw-data/.openclaw/agents/main/agent/models.json
```

OpenRouter provider 正确配置：
```json
{
  "openrouter": {
    "baseUrl": "https://openrouter.ai/api/v1",
    "api": "openai-responses",
    "apiKey": "sk-or-v1-...",
    "models": [...]
  }
}
```

---

## 已知问题 & 修复记录

### ⚠ [上游 bug] onboard 向导末尾报 TypeError

- 症状：`TypeError: Cannot read properties of undefined (reading 'trim')`
- 原因：openclaw onboard 向导最后一步写入 `openclaw.json` 时崩溃
- 影响：`auth-profiles.json` 和 `models.json` 已正常写入，只有 `openclaw.json` 可能丢失
- 处理：`reconfigure.js` 以 `auth-profiles.json` 为判断依据，不依赖 `openclaw.json`

### ⚠ [上游 bug] 项目路径含特殊字符导致 Gateway 崩溃

- 症状：`gateway run` 报 `Cannot find module '...\null'` 立即退出
- 原因：openclaw 内部路径解析遇到 `&` `$` `%` `!` `^` 等字符时失败
- 处理：`menu.js` 和 `toggle.js` 启动时检测路径并给出明确提示

### [已修复] npm postinstall 找不到 node

- 原因：npm 通过 `cmd.exe /c` 执行 postinstall，不继承 PowerShell 的 PATH
- 修复：`install-openclaw.js` 在 `npmEnv` 里显式把便携 node 目录放到 PATH 最前面

### [已修复] Windows 长路径导致安装失败

- 原因：openclaw 嵌套 node_modules 路径超过 Windows MAX_PATH（260字符）
- 修复：`install-openclaw.js` 安装前自动启用注册表长路径支持

### [已修复] openclaw.mjs 路径探测失败

- 原因：`OC_OPENCLAW_READY` 只检查 shim 存在，不检查 `openclaw.mjs`
- 修复：同时检查两者，任一不存在则视为未安装

### [已修复] Gateway 窗口黑屏无输出

- 原因：`spawn` 使用 `stdio: 'ignore'`，子进程输出被丢弃
- 修复：`toggle.js` 生成 `_gateway_start.bat` 并用 `cmd start` 打开新窗口，输出直接显示

### [已修复] Gateway 启动超时误报

- 原因：首次启动加载 500MB+ 模块需要 60-120 秒，原超时 45 秒不够
- 修复：超时改为 120 秒，并修复 HTTP 响应流未消费的问题

### [已修复] openclaw.json workspace 绝对路径

- 修复：`toggle.js` 启动前调用 `patchConfig()` 自动修正为当前实际路径

### [已修复] MinGit 版本号解析错误

- 修复：`ensure-git.js` 中 `tagToFileVer()` 正确转换 `v2.53.0.windows.3` → `2.53.0.3`

---

## openclaw 关键命令

```bash
# 初始化配置（交互式向导）
openclaw onboard

# 启动 Gateway
openclaw gateway run

# 查看版本
openclaw --version

# Dashboard 访问
http://127.0.0.1:18789/#token=<token>
# token 在 openclaw-data/.openclaw/openclaw.json 的 gateway.auth.token 字段
```

---

## 迁移注意事项

1. 整个目录直接复制，无需重新安装
2. 路径不能含特殊字符（`&` `$` `%` `!` `^`）
3. 迁移后首次启动会自动修正 `openclaw.json` 里的 workspace 绝对路径
4. 跨平台迁移（Windows ↔ Linux）需重新运行菜单 `[2]` 重新安装
5. `openclaw-data/` 目录包含所有配置和对话数据，迁移时务必一起复制
