#!/usr/bin/env bash
# ensure-nodejs.sh - Linux/macOS：确保便携 Node.js 可用
# 用法：source unix/ensure-nodejs.sh  （从项目根目录执行）
# 执行后导出：OC_NODE  OC_NODE_DIR  OC_NODE_READY

set -euo pipefail

# ── 根路径（脚本所在目录的上级）──────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── 探测已有便携 Node.js ──────────────────────────────────
OC_NODE=""
OC_NODE_DIR=""
OC_NODE_READY=false

for d in "$OC_ROOT"/node-v*/; do
  [ -d "$d" ] || continue
  exe="$d/bin/node"
  if [ -x "$exe" ]; then
    OC_NODE="$exe"
    OC_NODE_DIR="$d"
    OC_NODE_READY=true
    break
  fi
done

export OC_NODE OC_NODE_DIR OC_NODE_READY

if [ "$OC_NODE_READY" = true ]; then
  ver="$("$OC_NODE" --version 2>/dev/null || echo unknown)"
  echo "  ✓ Node.js $ver 已就绪"
  return 0 2>/dev/null || exit 0
fi

# ── 自动安装 Node.js LTS ──────────────────────────────────
echo ""
echo "  未检测到 Node.js，开始自动安装..."
echo ""

# 检测架构
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  NODE_ARCH="x64" ;;
  aarch64|arm64) NODE_ARCH="arm64" ;;
  armv7l)  NODE_ARCH="armv7l" ;;
  *)       echo "  ✗ 不支持的架构: $ARCH"; exit 1 ;;
esac

# 检测平台
OS="$(uname -s)"
case "$OS" in
  Linux)  NODE_PLATFORM="linux" ;;
  Darwin) NODE_PLATFORM="darwin" ;;
  *)      echo "  ✗ 不支持的平台: $OS"; exit 1 ;;
esac

# 查询最新 LTS 版本
MIRROR="https://npmmirror.com/mirrors/node"
echo "  [1/3] 查询最新 LTS 版本..."

if command -v curl &>/dev/null; then
  INDEX="$(curl -fsSL "$MIRROR/index.json" 2>/dev/null || \
           curl -fsSL "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/index.json")"
elif command -v wget &>/dev/null; then
  INDEX="$(wget -qO- "$MIRROR/index.json" 2>/dev/null || \
           wget -qO- "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/index.json")"
else
  echo "  ✗ 需要 curl 或 wget，请先安装。"
  exit 1
fi

# 解析最新 LTS 版本号（取第一个 lts 不为 false 的）
NODE_VER="$(echo "$INDEX" | grep -o '"version":"v[^"]*"' | head -20 | \
  while IFS= read -r line; do
    ver="${line#*\"version\":\"}"
    ver="${ver%\"}"
    # 检查对应行是否有 lts 字段且不为 false
    if echo "$INDEX" | grep -q "\"version\":\"$ver\".*\"lts\":\""; then
      echo "$ver"
      break
    fi
  done)"

# fallback：直接取第一个版本（通常是最新 LTS）
if [ -z "$NODE_VER" ]; then
  NODE_VER="$(echo "$INDEX" | grep -o '"version":"v[^"]*"' | head -1 | grep -o 'v[^"]*')"
fi

if [ -z "$NODE_VER" ]; then
  echo "  ✗ 无法获取 Node.js 版本信息"
  exit 1
fi

echo "        最新 LTS: $NODE_VER"

# 下载
TARBALL="node-${NODE_VER}-${NODE_PLATFORM}-${NODE_ARCH}.tar.gz"
URL="$MIRROR/$NODE_VER/$TARBALL"
DEST="$OC_ROOT/$TARBALL"

echo "  [2/3] 下载 $TARBALL ..."
echo "        $URL"

if command -v curl &>/dev/null; then
  curl -fL --progress-bar -o "$DEST" "$URL"
elif command -v wget &>/dev/null; then
  wget -q --show-progress -O "$DEST" "$URL"
fi

if [ ! -f "$DEST" ]; then
  echo "  ✗ 下载失败"
  exit 1
fi

echo "  [3/3] 解压到 $OC_ROOT ..."
tar -xzf "$DEST" -C "$OC_ROOT"
rm -f "$DEST"
echo "        解压完成"

# 重新探测
for d in "$OC_ROOT"/node-v*/; do
  [ -d "$d" ] || continue
  exe="$d/bin/node"
  if [ -x "$exe" ]; then
    OC_NODE="$exe"
    OC_NODE_DIR="$d"
    OC_NODE_READY=true
    break
  fi
done

export OC_NODE OC_NODE_DIR OC_NODE_READY

if [ "$OC_NODE_READY" = true ]; then
  ver="$("$OC_NODE" --version)"
  echo ""
  echo "  ✓ Node.js $ver 安装完成"
else
  echo "  ✗ Node.js 安装后仍未检测到，请检查目录结构。"
  exit 1
fi
