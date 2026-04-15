# Env.ps1 - OpenClaw 公共环境配置
# 用法：在其他脚本头部加一行  . "$PSScriptRoot\Env.ps1"

# ============ 根路径 ============
# OC_ROOT 始终指向项目根目录（Env.ps1 的上级目录）
$Global:OC_ROOT = Split-Path $PSScriptRoot -Parent

# ============ Node.js 变量 ============
$Global:OC_NODE      = $null
$Global:OC_NPM       = $null
$Global:OC_NPX       = $null
$Global:OC_NODE_DIR  = $null
$Global:OC_NODE_VER  = $null

$nodeExe = Get-ChildItem -Path $OC_ROOT -Filter "node.exe" -Recurse -Depth 2 -ErrorAction SilentlyContinue |
           Where-Object { $_.DirectoryName -match 'node-v' } |
           Select-Object -First 1

if ($nodeExe) {
    $Global:OC_NODE      = $nodeExe.FullName
    $Global:OC_NODE_DIR  = $nodeExe.DirectoryName
    $Global:OC_NPM       = Join-Path $OC_NODE_DIR "npm.cmd"
    $Global:OC_NPX       = Join-Path $OC_NODE_DIR "npx.cmd"
    $Global:OC_NODE_VER  = (& $OC_NODE --version 2>&1).ToString().Trim()

    # 临时注入 PATH，仅当前进程有效，不污染系统
    if ($env:PATH -notlike "*$OC_NODE_DIR*") {
        $env:PATH = "$OC_NODE_DIR;$env:PATH"
    }
    $Global:OC_NODE_READY = $true
} else {
    $Global:OC_NODE_READY = $false
}

# ============ OpenClaw 便携目录（所有数据落在项目目录）============
# openclaw 实际把配置写在 $OPENCLAW_HOME/.openclaw/ 子目录下
$Global:OC_HOME       = Join-Path $OC_ROOT "openclaw-data"
$Global:OC_CONFIG     = Join-Path $Global:OC_HOME ".openclaw\openclaw.json"
$Global:OC_WORKSPACE  = Join-Path $Global:OC_HOME "workspace"
# 注入环境变量，对当前进程及其子进程（node/openclaw）生效
$env:OPENCLAW_HOME    = $Global:OC_HOME

# ============ OpenClaw 变量 ============
# openclaw 安装在项目目录下独立的 openclaw 文件夹，与 node 同级
$ocPrefix = Join-Path $OC_ROOT "openclaw"
$ocShim   = Join-Path $ocPrefix "openclaw.cmd"
$ocMjs    = Join-Path $ocPrefix "node_modules\openclaw\openclaw.mjs"

if (Test-Path $ocShim) {
    $Global:OC_OPENCLAW     = $ocShim
    $Global:OC_OPENCLAW_MJS = if (Test-Path $ocMjs) { $ocMjs } else { $null }
    if ($Global:OC_NODE_READY -and $Global:OC_OPENCLAW_MJS) {
        $Global:OC_OPENCLAW_VER = (& $Global:OC_NODE $Global:OC_OPENCLAW_MJS --version 2>&1).ToString().Trim()
    } else {
        $Global:OC_OPENCLAW_VER = "unknown"
    }
    $Global:OC_OPENCLAW_CONFIGURED = (Test-Path $Global:OC_CONFIG)
    $Global:OC_OPENCLAW_READY      = $true
} else {
    $Global:OC_OPENCLAW            = $null
    $Global:OC_OPENCLAW_MJS        = $null
    $Global:OC_OPENCLAW_VER        = $null
    $Global:OC_OPENCLAW_READY      = $false
    $Global:OC_OPENCLAW_CONFIGURED = $false
}

# ============ 通用目录 ============
$Global:OC_DATA_DIR = Join-Path $OC_ROOT "data"
$Global:OC_LOG_DIR  = Join-Path $OC_ROOT "logs"

foreach ($d in @($OC_DATA_DIR, $OC_LOG_DIR)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# ============ 工具函数 ============

function OC-RequireNode {
    <#
    .SYNOPSIS 检查 Node.js 是否可用，未就绪则提示并退出当前脚本
    #>
    if (-not $OC_NODE_READY) {
        Write-Host ""
        Write-Host "  ✗ 未检测到 Node.js 环境" -ForegroundColor Red
        Write-Host "  请先运行菜单 [1] Node.js 环境初始化" -ForegroundColor Yellow
        Write-Host ""
        throw "NODE_NOT_FOUND"
    }
    Write-Host "  ✓ Node.js $OC_NODE_VER" -ForegroundColor DarkGray
}

function OC-Log {
    <#
    .SYNOPSIS 写一行带时间戳的日志到 logs 目录
    #>
    param([string]$Message, [string]$File = "openclaw.log")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Add-Content -Path (Join-Path $OC_LOG_DIR $File) -Value $line -Encoding UTF8
}

function OC-RunNode {
    <#
    .SYNOPSIS 用本地 Node.js 运行脚本
    .EXAMPLE OC-RunNode "server.js" "--port" "3000"
    #>
    param([Parameter(ValueFromRemainingArguments)]$Arguments)
    OC-RequireNode
    & $OC_NODE @Arguments
}

function OC-RunNpm {
    <#
    .SYNOPSIS 用本地 npm 执行命令
    .EXAMPLE OC-RunNpm install express
    #>
    param([Parameter(ValueFromRemainingArguments)]$Arguments)
    OC-RequireNode
    & $OC_NPM @Arguments
}
