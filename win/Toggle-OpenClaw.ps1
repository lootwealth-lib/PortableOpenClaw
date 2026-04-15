# Toggle-OpenClaw.ps1 - 菜单选项 [4]：启动 / 停止 OpenClaw Gateway

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "===== OpenClaw 启动 / 停止 =====" -ForegroundColor Yellow

# ── 确保环境就绪 ────────────────────────────────────────────
. "$PSScriptRoot\Ensure-NodeJS.ps1"

if (-not $Global:OC_OPENCLAW_READY) {
    Write-Host "  ✗ OpenClaw 未安装，请先运行菜单 [2]" -ForegroundColor Red
    Write-Host ""
    return
}

$ocMjs     = $Global:OC_OPENCLAW_MJS

# ── 检测当前运行状态 ────────────────────────────────────────
Write-Host ""
Write-Host "  当前状态：" -ForegroundColor Cyan
. "$PSScriptRoot\Get-OpenClawStatus.ps1"

if ($Global:OC_RUNNING) {
    # ── 已在运行 → 询问是否停止 ────────────────────────────
    $ans = Read-Host "  OpenClaw 正在运行，是否停止？[y/N]"
    if ($ans -match '^[Yy]$') {
        Write-Host "  正在停止..." -ForegroundColor Yellow
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            try { $_.MainModule.FileName -like "*$Global:OC_NODE_DIR*" } catch { $false }
        } | ForEach-Object {
            try {
                $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
                if ($cmd -like "*openclaw*") {
                    Stop-Process -Id $_.Id -Force
                    Write-Host "  ✓ 已停止 PID $($_.Id)" -ForegroundColor Green
                }
            } catch { }
        }
        OC-Log "OpenClaw 已手动停止"
    } else {
        Write-Host "  已取消。" -ForegroundColor DarkGray
    }
    Write-Host ""
    return
}

# ── 未运行 → 检测是否已完成初始化配置 ─────────────────────
Write-Host ""

$needOnboard = $false
if (-not (Test-Path $Global:OC_CONFIG)) {
    $needOnboard = $true
    Write-Host "  ⚠ 未检测到配置文件，需要先完成初始化引导。" -ForegroundColor Yellow
} else {
    $configContent = Get-Content $Global:OC_CONFIG -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($configContent -match 'changeme|placeholder|example-token|CHANGE_ME') {
        $needOnboard = $true
        Write-Host "  ⚠ 检测到配置中仍有默认占位 token，需要重新完成引导配置。" -ForegroundColor Yellow
    }
}

if ($needOnboard) {
    Write-Host ""
    Write-Host "  OpenClaw 首次使用需要完成初始化引导（onboard）。" -ForegroundColor Cyan
    Write-Host "  引导过程将在新窗口中运行，请按提示完成配置后关闭该窗口。" -ForegroundColor Cyan
    Write-Host "  完成后重新选择 [4] 即可启动 Gateway。" -ForegroundColor Cyan
    Write-Host ""
    $ans = Read-Host "  是否现在运行初始化引导？[Y/n]"
    if ($ans -notmatch '^[Nn]$') {
        # 在新窗口运行 onboard，保持窗口不关闭以便用户操作
        $args = "/k `"$($Global:OC_NODE)`" `"$ocMjs`" onboard --non-interactive --skip-health --accept-risk"
        Start-Process -FilePath "cmd.exe" -ArgumentList $args -WindowStyle Normal
        Write-Host ""
        Write-Host "  引导窗口已打开，请在该窗口完成配置。" -ForegroundColor Green
        Write-Host "  完成后关闭引导窗口，再次选择 [4] 启动 Gateway。" -ForegroundColor DarkGray
    } else {
        Write-Host "  已取消。" -ForegroundColor DarkGray
    }
    Write-Host ""
    return
}

# ── 启动 Gateway ────────────────────────────────────────────
$ans = Read-Host "  OpenClaw 未运行，是否启动 Gateway？[Y/n]"
if ($ans -match '^[Nn]$') {
    Write-Host "  已取消。" -ForegroundColor DarkGray
    Write-Host ""
    return
}

Write-Host "  正在后台启动 OpenClaw Gateway..." -ForegroundColor Cyan

# 用 cmd /k 保持窗口，方便查看日志；Gateway 是长驻进程
$startArgs = "/k title OpenClaw Gateway && `"$($Global:OC_NODE)`" `"$ocMjs`" gateway run"
Start-Process -FilePath "cmd.exe" -ArgumentList $startArgs -WindowStyle Normal

# 读取 token 用于打开 Dashboard（从便携配置文件读取）
$dashToken = ""
if (Test-Path $Global:OC_CONFIG) {
    try {
        $cfg = Get-Content $Global:OC_CONFIG -Raw -Encoding UTF8 | ConvertFrom-Json
        $dashToken = $cfg.gateway.auth.token
    } catch { }
}
$dashUrl = if ($dashToken) { "http://127.0.0.1:18789/#token=$dashToken" } else { "http://127.0.0.1:18789/" }

# 等待 Gateway 就绪（最多 45 秒，gateway 启动约需 36 秒）
Write-Host "  等待 Gateway 就绪" -ForegroundColor DarkGray -NoNewline
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:18789/" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -lt 500) { $ready = $true; break }
    } catch { }
}
Write-Host ""

if ($ready) {
    Write-Host "  ✓ Gateway 已就绪" -ForegroundColor Green
    OC-Log "OpenClaw Gateway 已启动"
    Write-Host "  正在打开 Dashboard..." -ForegroundColor Cyan
    Start-Process $dashUrl
} else {
    Write-Host "  ⚠ 45 秒内未检测到 Gateway 响应，请查看 Gateway 窗口中的错误信息。" -ForegroundColor Yellow
    Write-Host "    常见原因：配置未完成（请先运行 onboard）或端口被占用。" -ForegroundColor DarkGray
}

Write-Host ""
