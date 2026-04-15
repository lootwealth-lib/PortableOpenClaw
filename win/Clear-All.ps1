# Clear-All.ps1 - 菜单选项 [5]：一键清除
# 删除内容：Node.js 目录、openclaw 包目录、openclaw-data 配置目录

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\Env.ps1"

Write-Host ""
Write-Host "===== 一键清除 =====" -ForegroundColor Yellow
Write-Host ""
Write-Host "  将删除以下内容：" -ForegroundColor Cyan

# 收集要删除的目录
$targets = @()

# Node.js 目录
if ($Global:OC_NODE_DIR -and (Test-Path $Global:OC_NODE_DIR)) {
    $targets += @{ Path = $Global:OC_NODE_DIR; Label = "Node.js       : $Global:OC_NODE_DIR" }
} else {
    $nodeDir = Get-ChildItem -Path $Global:OC_ROOT -Filter "node-v*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($nodeDir) { $targets += @{ Path = $nodeDir.FullName; Label = "Node.js       : $($nodeDir.FullName)" } }
}

# openclaw 包目录
$ocPkgDir = Join-Path $Global:OC_ROOT "openclaw"
if (Test-Path $ocPkgDir) {
    $targets += @{ Path = $ocPkgDir; Label = "OpenClaw 包   : $ocPkgDir" }
}

# openclaw-data 配置/数据目录
if (Test-Path $Global:OC_HOME) {
    $targets += @{ Path = $Global:OC_HOME; Label = "OpenClaw 数据 : $Global:OC_HOME" }
}

if ($targets.Count -eq 0) {
    Write-Host "  没有找到需要清除的内容。" -ForegroundColor DarkGray
    Write-Host ""
    return
}

foreach ($t in $targets) { Write-Host "    - $($t.Label)" -ForegroundColor Red }

Write-Host ""
Write-Host "  ⚠ 此操作不可撤销，所有配置和敏感信息将被永久删除！" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "  确认清除？请输入 YES 继续"

if ($confirm -ne 'YES') {
    Write-Host "  已取消。" -ForegroundColor DarkGray
    Write-Host ""
    return
}

# 若 OpenClaw 正在运行，先停止
Write-Host ""
$ocProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmd -like "*openclaw*"
    } catch { $false }
}
if ($ocProcs) {
    Write-Host "  检测到 OpenClaw 正在运行，正在停止..." -ForegroundColor Yellow
    $ocProcs | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
    Write-Host "  ✓ 已停止 OpenClaw 进程" -ForegroundColor Green
}

# 逐一删除
foreach ($t in $targets) {
    Write-Host "  删除 $($t.Path) ..." -ForegroundColor Cyan
    try {
        Remove-Item -Path $t.Path -Recurse -Force -ErrorAction Stop
        Write-Host "  ✓ 已删除" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ 删除失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "  清除完成。重新运行菜单 [1][2] 可重新安装。" -ForegroundColor Green
Write-Host ""
