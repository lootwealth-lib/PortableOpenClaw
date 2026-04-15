$ErrorActionPreference = 'Stop'

# 确保 Node.js 就绪
. "$PSScriptRoot\Ensure-NodeJS.ps1"

# 用便携 Node.js 启动跨平台菜单
$menuScript = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\menu.js"
& $Global:OC_NODE $menuScript
