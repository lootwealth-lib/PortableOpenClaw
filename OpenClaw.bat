@echo off
chcp 65001 >nul
title OpenClaw
powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%~dp0win\Menu.ps1"
pause
