# Init-NodeJS.ps1 - 菜单选项 [1]：Node.js 环境初始化
# 直接复用 Ensure-NodeJS.ps1，确保 Node.js 可用后显示详细信息

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "===== Node.js 环境初始化 =====" -ForegroundColor Yellow
Write-Host ""

. "$PSScriptRoot\Ensure-NodeJS.ps1"

# 显示详细信息
Write-Host ""
Write-Host "  Node.js : $Global:OC_NODE_VER" -ForegroundColor Green
$npmVer = (& $Global:OC_NPM --version 2>&1).ToString().Trim()
Write-Host "  npm     : v$npmVer" -ForegroundColor Green
Write-Host "  路径    : $Global:OC_NODE" -ForegroundColor Green
Write-Host ""
Write-Host "  如需重装，请手动删除 $Global:OC_NODE_DIR 后再运行。" -ForegroundColor DarkGray
