#!/usr/bin/env node
// clear-all.js - 菜单 [5]：一键清除

'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const env = require('./env.js');
const { findOCProcesses } = require('./status.js');

const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function removeDir(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`${C.green}  ✓ 已删除${C.reset}`);
  } catch (e) {
    console.log(`${C.red}  ✗ 删除失败: ${e.message}${C.reset}`);
  }
}

async function main() {
  console.log('');
  console.log(`${C.yellow}===== 一键清除 =====${C.reset}`);
  console.log('');
  console.log(`${C.cyan}  将删除以下内容：${C.reset}`);

  const targets = [];

  // Node.js 目录
  if (env.OC_NODE_DIR && fs.existsSync(env.OC_NODE_DIR)) {
    targets.push({ path: env.OC_NODE_DIR, label: `Node.js       : ${env.OC_NODE_DIR}` });
  } else {
    // 扫描 OC_ROOT 下 node-v* 目录
    for (const entry of fs.readdirSync(env.OC_ROOT)) {
      if (!entry.match(/^node-v/)) continue;
      const full = path.join(env.OC_ROOT, entry);
      if (fs.statSync(full).isDirectory()) {
        targets.push({ path: full, label: `Node.js       : ${full}` });
        break;
      }
    }
  }

  // openclaw 包目录
  const ocPkgDir = path.join(env.OC_ROOT, 'openclaw');
  if (fs.existsSync(ocPkgDir)) {
    targets.push({ path: ocPkgDir, label: `OpenClaw 包   : ${ocPkgDir}` });
  }

  // MinGit 便携目录（Windows）
  const mingitDir = path.join(env.OC_ROOT, 'mingit');
  if (fs.existsSync(mingitDir)) {
    targets.push({ path: mingitDir, label: `MinGit        : ${mingitDir}` });
  }

  // openclaw-data 目录
  if (fs.existsSync(env.OC_HOME)) {
    targets.push({ path: env.OC_HOME, label: `OpenClaw 数据 : ${env.OC_HOME}` });
  }

  if (targets.length === 0) {
    console.log(`${C.gray}  没有找到需要清除的内容。${C.reset}`);
    console.log('');
    return;
  }

  for (const t of targets) {
    console.log(`${C.red}    - ${t.label}${C.reset}`);
  }

  console.log('');
  console.log(`${C.yellow}  ⚠ 此操作不可撤销，所有配置和数据将被永久删除！${C.reset}`);
  console.log('');
  const confirm = await ask('  确认清除？请输入 YES 继续: ');

  if (confirm !== 'YES') {
    console.log(`${C.gray}  已取消。${C.reset}`);
    console.log('');
    return;
  }

  // 先停止运行中的 openclaw 进程
  const procs = findOCProcesses();
  if (procs.length > 0) {
    console.log(`${C.yellow}  检测到 OpenClaw 正在运行，正在停止...${C.reset}`);
    for (const p of procs) {
      try {
        if (env.IS_WIN) {
          execFileSync('taskkill', ['/PID', String(p.pid), '/F'], { stdio: 'ignore' });
        } else {
          process.kill(p.pid, 'SIGTERM');
        }
      } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
    console.log(`${C.green}  ✓ 已停止 OpenClaw 进程${C.reset}`);
  }

  // 逐一删除
  for (const t of targets) {
    console.log(`${C.cyan}  删除 ${t.path} ...${C.reset}`);
    removeDir(t.path);
  }

  console.log('');
  console.log(`${C.green}  清除完成。重新运行入口脚本可重新安装。${C.reset}`);
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
