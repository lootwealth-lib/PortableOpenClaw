@echo off
chcp 65001 >nul
:: 用 PowerShell 找到便携 node.exe 路径，写入临时变量
for /f "delims=" %%N in ('powershell.exe -NoProfile -NonInteractive -Command ^
  "(gci '%~dp0' -r -depth 3 -filter node.exe 2>$null | ?{$_.DirectoryName -match 'node-v'} | select -first 1).FullName"') do set "_NODE=%%N"

if not defined _NODE (
  echo Node.js 未就绪，请先运行 OpenClaw.bat 完成初始化
  exit /b 1
)

"%_NODE%" "%~dp0scripts\run-openclaw.js" %*
