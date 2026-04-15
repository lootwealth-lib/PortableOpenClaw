#!/usr/bin/env bash
# claw.sh - Linux/macOS 命令行透传入口
# 用法：bash claw.sh [参数]
#        chmod +x claw.sh && ./claw.sh --version

set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OC_ROOT="$(pwd)"

# 找便携 node
OC_NODE=""
for d in "$OC_ROOT"/node-v*/; do
  [ -d "$d" ] || continue
  exe="$d/bin/node"
  if [ -x "$exe" ]; then OC_NODE="$exe"; break; fi
done

if [ -z "$OC_NODE" ]; then
  echo "Node.js 未就绪，请先运行 ./openclaw.sh 完成初始化"
  exit 1
fi

export OPENCLAW_HOME="$OC_ROOT/openclaw-data"
exec "$OC_NODE" "$OC_ROOT/scripts/run-openclaw.js" "$@"
