# Install-OpenClaw.ps1 - 菜单选项 [2]：OpenClaw 安装 / 检测
# 1. 确保 Node.js 可用（自动安装）
# 2. 检测 OpenClaw 是否已安装（通过 Env.ps1 的 OC_OPENCLAW_READY）
# 3. 未安装则通过 npm 从国内镜像下载最新版

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "===== OpenClaw 安装检测 =====" -ForegroundColor Yellow
Write-Host ""

# ── 步骤 1：确保 Node.js 就绪 ──────────────────────────────
. "$PSScriptRoot\Ensure-NodeJS.ps1"

# ── 步骤 2：检测 OpenClaw（Env.ps1 已检测，直接复用）──────
Write-Host ""
Write-Host "  检测 OpenClaw..." -ForegroundColor Cyan

if ($Global:OC_OPENCLAW_READY) {
    Write-Host "  ✓ OpenClaw 已安装：v$Global:OC_OPENCLAW_VER" -ForegroundColor Green
    Write-Host "    路径：$Global:OC_OPENCLAW" -ForegroundColor DarkGray
    OC-Log "OpenClaw v$Global:OC_OPENCLAW_VER 检测通过"
    Write-Host ""
    return
}

# ── 步骤 3：安装 OpenClaw ───────────────────────────────────
Write-Host "  未检测到 OpenClaw，开始安装最新版..." -ForegroundColor Yellow
Write-Host ""

$ocPrefix = Join-Path $Global:OC_ROOT "openclaw"
$npmCli   = Join-Path $Global:OC_NODE_DIR "node_modules\npm\bin\npm-cli.js"

# 检测 git（openclaw 的 WhatsApp 依赖 libsignal 通过 git URL 安装）
$gitOk = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if (-not $gitOk) {
    Write-Host "  ⚠ 未检测到 git，openclaw 安装需要 git。" -ForegroundColor Yellow
    Write-Host "    下载地址：https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "    安装 git 后重新运行此选项。" -ForegroundColor DarkGray
    Write-Host ""
    return
}

Write-Host "  配置 npm 镜像源（npmmirror）..." -ForegroundColor Cyan
& $Global:OC_NODE $npmCli config set registry https://registry.npmmirror.com 2>&1 | Out-Null

Write-Host "  设置 npm prefix: $ocPrefix" -ForegroundColor Cyan
& $Global:OC_NODE $npmCli config set prefix "$ocPrefix" 2>&1 | Out-Null

Write-Host "  执行 npm install -g openclaw@latest ..." -ForegroundColor Cyan
& $Global:OC_NODE $npmCli install -g openclaw@latest

# 重新加载 Env.ps1 刷新 OC_OPENCLAW_* 变量
. "$PSScriptRoot\Env.ps1"

if ($Global:OC_OPENCLAW_READY) {
    Write-Host ""
    Write-Host "  ✓ OpenClaw v$Global:OC_OPENCLAW_VER 安装完成" -ForegroundColor Green
    Write-Host "    路径：$Global:OC_OPENCLAW" -ForegroundColor DarkGray
    OC-Log "OpenClaw v$Global:OC_OPENCLAW_VER 安装完成"

    # ── 步骤 4：生成最小配置（若尚未配置）─────────────────
    if (-not $Global:OC_OPENCLAW_CONFIGURED) {
        Write-Host ""
        Write-Host "  生成便携配置文件..." -ForegroundColor Cyan
        Write-Host "    目录: $Global:OC_HOME" -ForegroundColor DarkGray
        # OPENCLAW_HOME 已由 Env.ps1 注入，onboard 会自动写入该目录
        & $Global:OC_NODE $Global:OC_OPENCLAW_MJS onboard --non-interactive --skip-health --accept-risk 2>&1 | Out-Null
        # 重载 Env.ps1 刷新 OC_OPENCLAW_CONFIGURED
        . "$PSScriptRoot\Env.ps1"
        if ($Global:OC_OPENCLAW_CONFIGURED) {
            Write-Host "  ✓ 配置文件已生成：$Global:OC_CONFIG" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ 配置文件生成失败，请手动运行：claw.bat onboard --non-interactive --skip-health --accept-risk" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✓ 配置文件已存在，跳过初始化" -ForegroundColor DarkGray
    }
} else {
    $prefix = (& $Global:OC_NPM config get prefix 2>&1).ToString().Trim()
    Write-Host ""
    Write-Host "  ✗ 安装后未找到 openclaw 命令，请检查 npm 输出。" -ForegroundColor Red
    Write-Host "    npm prefix: $prefix" -ForegroundColor DarkGray
}

Write-Host ""
