#!/usr/bin/env bash
# openclaw.sh - Linux/macOS 主入口
# 用法：bash openclaw.sh
#       chmod +x openclaw.sh && ./openclaw.sh

set -euo pipefail

# ── 切换到项目根目录 ──────────────────────────────────────
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OC_ROOT="$(pwd)"

# ── 确保 Node.js 可用 ─────────────────────────────────────
source "$OC_ROOT/unix/ensure-nodejs.sh"

# ── 注入 OPENCLAW_HOME ────────────────────────────────────
export OPENCLAW_HOME="$OC_ROOT/openclaw-data"

# ── 启动跨平台菜单 ────────────────────────────────────────
exec "$OC_NODE" "$OC_ROOT/scripts/menu.js"
