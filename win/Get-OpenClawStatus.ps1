# Get-OpenClawStatus.ps1 - 查看 OpenClaw 运行状态
# 可被其他脚本 dot-source 复用：. "$PSScriptRoot\Get-OpenClawStatus.ps1"
# dot-source 后可直接使用 $Global:OC_RUNNING / $Global:OC_PID

. "$PSScriptRoot\Env.ps1"

function Get-OCStatus {
    $procs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try { $_.MainModule.FileName -like "*$Global:OC_NODE_DIR*" } catch { $false }
    }
    # 进一步过滤命令行中包含 openclaw 的进程
    $ocProcs = $procs | Where-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmd -like "*openclaw*"
        } catch { $false }
    }
    return $ocProcs
}

$ocProcs = Get-OCStatus

if ($ocProcs) {
    $Global:OC_RUNNING = $true
    $Global:OC_PID     = ($ocProcs | Select-Object -First 1).Id
    Write-Host ""
    Write-Host "  ● OpenClaw 运行中" -ForegroundColor Green
    $ocProcs | ForEach-Object {
        Write-Host "    PID: $($_.Id)  内存: $([math]::Round($_.WorkingSet64/1MB,1)) MB" -ForegroundColor DarkGray
    }
    Write-Host "    Dashboard: http://127.0.0.1:18789/" -ForegroundColor Cyan
} else {
    $Global:OC_RUNNING = $false
    $Global:OC_PID     = $null
    Write-Host ""
    Write-Host "  ○ OpenClaw 未运行" -ForegroundColor DarkGray
}
Write-Host ""
