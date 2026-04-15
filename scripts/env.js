#!/usr/bin/env node
// env.js - 跨平台公共环境探测
// 用法：const env = require('./env.js')

'use strict';

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ── 根路径（scripts/ 的上级） ──────────────────────────────
const OC_ROOT = path.resolve(__dirname, '..');

// ── 平台 ───────────────────────────────────────────────────
const PLATFORM = process.platform; // 'win32' | 'linux' | 'darwin'
const IS_WIN   = PLATFORM === 'win32';

// ── Node.js 探测 ───────────────────────────────────────────
function findNodeDir() {
  // 在 OC_ROOT 下查找 node-v* 目录（深度 2）
  for (const entry of fs.readdirSync(OC_ROOT)) {
    if (!entry.match(/^node-v/)) continue;
    const full = path.join(OC_ROOT, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    const exe = IS_WIN
      ? path.join(full, 'node.exe')
      : path.join(full, 'bin', 'node');
    if (fs.existsSync(exe)) return { dir: full, exe };
  }
  return null;
}

const nodeFound = findNodeDir();

const OC_NODE_DIR   = nodeFound ? nodeFound.dir : null;
const OC_NODE       = nodeFound ? nodeFound.exe : process.execPath; // fallback: 当前 node
const OC_NODE_READY = !!nodeFound;

let OC_NODE_VER = null;
if (OC_NODE_READY) {
  try { OC_NODE_VER = execFileSync(OC_NODE, ['--version'], { encoding: 'utf8' }).trim(); } catch {}
}

// npm-cli.js 路径（避免 npm.cmd 在含特殊字符路径下失效）
const OC_NPM_CLI = OC_NODE_DIR
  ? path.join(OC_NODE_DIR, IS_WIN ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js')
  : null;

// ── OpenClaw 探测 ──────────────────────────────────────────
// openclaw 实际把配置写在 $OPENCLAW_HOME/.openclaw/ 子目录下
const OC_HOME        = path.join(OC_ROOT, 'openclaw-data');
const OC_OPENCLAW_DIR = path.join(OC_HOME, '.openclaw');
const OC_CONFIG      = path.join(OC_OPENCLAW_DIR, 'openclaw.json');

const ocPrefix = path.join(OC_ROOT, 'openclaw', IS_WIN ? 'win' : 'unix');
const ocShim   = IS_WIN
  ? path.join(ocPrefix, 'openclaw.cmd')
  : path.join(ocPrefix, 'bin', 'openclaw');
const ocMjs    = path.join(ocPrefix,
  IS_WIN
    ? 'node_modules/openclaw/openclaw.mjs'
    : 'lib/node_modules/openclaw/openclaw.mjs');

const OC_OPENCLAW_READY = fs.existsSync(ocShim) && fs.existsSync(ocMjs);
const OC_OPENCLAW_MJS   = fs.existsSync(ocMjs) ? ocMjs : null;

let OC_OPENCLAW_VER = null;
if (OC_OPENCLAW_READY && OC_OPENCLAW_MJS && OC_NODE_READY) {
  try {
    OC_OPENCLAW_VER = execFileSync(OC_NODE, [OC_OPENCLAW_MJS, '--version'], {
      encoding: 'utf8',
      env: { ...process.env, OPENCLAW_HOME: OC_HOME },
    }).trim();
  } catch {}
}

const OC_OPENCLAW_CONFIGURED = fs.existsSync(OC_CONFIG);

// ── 日志目录 ───────────────────────────────────────────────
const OC_LOG_DIR = path.join(OC_ROOT, 'logs');
if (!fs.existsSync(OC_LOG_DIR)) fs.mkdirSync(OC_LOG_DIR, { recursive: true });

function ocLog(message, file = 'openclaw.log') {
  const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${message}\n`;
  fs.appendFileSync(path.join(OC_LOG_DIR, file), line, 'utf8');
}

// ── 注入 OPENCLAW_HOME 到当前进程 ─────────────────────────
process.env.OPENCLAW_HOME = OC_HOME;

module.exports = {
  OC_ROOT,
  PLATFORM,
  IS_WIN,
  OC_NODE,
  OC_NODE_DIR,
  OC_NODE_READY,
  OC_NODE_VER,
  OC_NPM_CLI,
  OC_HOME,
  OC_OPENCLAW_DIR,
  OC_CONFIG,
  OC_OPENCLAW_READY,
  OC_OPENCLAW_MJS,
  OC_OPENCLAW_VER,
  OC_OPENCLAW_CONFIGURED,
  OC_LOG_DIR,
  ocLog,
};
