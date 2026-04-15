# OpenClaw 便携工具箱

[OpenClaw](https://github.com/openclaw/openclaw) AI 网关的完全便携版本，支持 Windows / Linux / macOS。
所有组件（Node.js、OpenClaw、配置数据）均安装在项目目录内，不依赖系统环境，不污染系统 PATH。

---

## 快速开始

### Windows

双击 `OpenClaw.bat`，按菜单顺序操作：

```
[1] Node.js 环境初始化    ← 首次使用必须先执行（自动下载便携 Node.js）
[2] OpenClaw 安装/检测    ← 自动下载安装 OpenClaw 和 MinGit
[6] 重新配置              ← 首次配置 AI provider 和 Telegram 等通道
[4] 启动 / 停止 Gateway   ← 启动后自动打开 Dashboard
```

### Linux / macOS

```bash
chmod +x openclaw.sh
./openclaw.sh
```

---

## 菜单功能

| 编号 | 功能 | 说明 |
|------|------|------|
| [1] | Node.js 环境信息 | 显示便携 Node.js 版本和路径 |
| [2] | OpenClaw 安装/检测 | 安装或检测 OpenClaw，Windows 自动下载 MinGit |
| [3] | OpenClaw 运行状态 | 查看 Gateway 是否在运行 |
| [4] | 启动 / 停止 Gateway | 有配置直接启动，无配置自动引导 onboard |
| [5] | 一键清除 | 删除 Node.js、OpenClaw、配置数据 |
| [6] | 重新配置 | 清除旧配置，重新运行 onboard 向导 |

---

## 首次配置（onboard 向导）

运行菜单 `[6]` 会启动 openclaw 原生 onboard 向导，引导你完成：

1. 选择 AI provider 并输入 API Key
   - OpenRouter：选 `openrouter` → 填入 `sk-or-v1-...`
   - OpenAI：选 `openai` → 填入 `sk-...`
   - 其他兼容 OpenAI 格式的 provider：选 `openai-compatible` → 填 Base URL 和 Key

2. 配置通道（可选）
   - Telegram：需要先在 [@BotFather](https://t.me/BotFather) 创建 bot 获取 token

3. 向导完成后选菜单 `[4]` 启动 Gateway

> **已知问题**：onboard 向导最后一步可能报 `TypeError: Cannot read properties of undefined (reading 'trim')`，这是 openclaw 上游 bug，不影响配置结果，配置文件已正常写入。

---

## Dashboard

Gateway 启动后访问：

```
http://127.0.0.1:18789/#token=<your-token>
```

token 在 `openclaw-data/.openclaw/openclaw.json` 的 `gateway.auth.token` 字段。

---

## 命令行透传

```bat
# Windows
claw.bat --version
claw.bat gateway run

# Linux/macOS
./claw.sh --version
./claw.sh gateway run
```

---

## 迁移说明

整个项目目录可以直接复制到新机器，无需重新安装。

**注意事项：**
- 路径不能含特殊字符（`&` `$` `%` `!` `^`），否则 Gateway 无法启动
- 迁移后首次启动，`toggle.js` 会自动修正 `openclaw.json` 里的绝对路径
- 如果迁移到不同操作系统，需要重新运行菜单 `[2]` 重新安装对应平台的 OpenClaw

---

## 目录结构

```
项目根目录/
├── OpenClaw.bat          # Windows 主入口
├── openclaw.sh           # Linux/macOS 主入口
├── claw.bat              # Windows 命令行透传
├── claw.sh               # Linux/macOS 命令行透传
├── _gateway_start.bat    # Gateway 启动脚本（自动生成，可直接双击）
├── scripts/              # 核心业务逻辑（跨平台 Node.js）
├── win/                  # Windows 专属脚本
├── unix/                 # Linux/macOS 专属脚本
├── node-v*/              # 便携 Node.js（自动下载）
├── mingit/               # 便携 MinGit，Windows 专用（自动下载）
├── openclaw/             # OpenClaw npm 包（自动安装）
├── openclaw-data/        # 配置和数据（OPENCLAW_HOME）
│   └── .openclaw/
│       ├── openclaw.json         # 主配置（含 token、Telegram、provider）
│       ├── agents/main/agent/
│       │   ├── auth-profiles.json  # AI provider API Key
│       │   └── models.json         # 模型配置
│       └── workspace/            # Agent 工作区
└── logs/                 # 运行日志
```

---

## 开发文档

见 [DEV-CONTEXT.md](DEV-CONTEXT.md)
