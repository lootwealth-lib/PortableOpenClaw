#!/usr/bin/env node
// reconfigure.js - 菜单 [6]：重新配置（清除旧配置，运行 onboard 向导）

'use strict';

const fs   = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync, execFileSync } = require('child_process');

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

// 需要清除的配置文件/目录（保留 workspace 数据）
const CONFIG_TARGETS = [
  { path: () => env.OC_CONFIG,                                          label: 'openclaw.json（主配置）' },
  { path: () => path.join(env.OC_OPENCLAW_DIR, 'agents', 'main', 'agent', 'auth-profiles.json'), label: 'auth-profiles.json（AI provider 认证）' },
  { path: () => path.join(env.OC_OPENCLAW_DIR, 'agents', 'main', 'agent', 'models.json'),        label: 'models.json（模型配置）' },
];

async function main() {
  console.log('');
  console.log(`${C.yellow}===== 重新配置 OpenClaw =====${C.reset}`);

  if (!env.OC_NODE_READY) {
    console.log(`${C.red}  ✗ Node.js 未就绪，请先运行菜单 [1]${C.reset}`);
    process.exit(1);
  }
  if (!env.OC_OPENCLAW_READY) {
    console.log(`${C.red}  ✗ OpenClaw 未安装，请先运行菜单 [2]${C.reset}`);
    process.exit(1);
  }

  // ── 检测并停止运行中的 Gateway ────────────────────────────
  const procs = findOCProcesses();
  if (procs.length > 0) {
    console.log(`${C.yellow}  检测到 Gateway 正在运行，需要先停止。${C.reset}`);
    const ans = await ask('  停止 Gateway 并继续？[Y/n] ');
    if (/^[Nn]/.test(ans)) {
      console.log(`${C.gray}  已取消。${C.reset}`);
      console.log('');
      return;
    }
    for (const p of procs) {
      try {
        if (env.IS_WIN) {
          execFileSync('taskkill', ['/PID', String(p.pid), '/F'], { stdio: 'ignore' });
        } else {
          process.kill(p.pid, 'SIGTERM');
        }
        console.log(`${C.green}  ✓ 已停止 PID ${p.pid}${C.reset}`);
      } catch (e) {
        console.log(`${C.red}  ✗ 停止失败: ${e.message}${C.reset}`);
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // ── 列出将要删除的配置 ────────────────────────────────────
  console.log('');
  const existing = CONFIG_TARGETS.filter(t => fs.existsSync(t.path()));

  if (existing.length === 0) {
    console.log(`${C.gray}  未检测到已有配置，直接运行 onboard 向导。${C.reset}`);
  } else {
    console.log(`${C.cyan}  将清除以下配置文件：${C.reset}`);
    existing.forEach(t => console.log(`${C.yellow}    - ${t.label}${C.reset}`));
    console.log('');
    const ans = await ask('  确认清除并重新配置？[Y/n] ');
    if (/^[Nn]/.test(ans)) {
      console.log(`${C.gray}  已取消。${C.reset}`);
      console.log('');
      return;
    }

    // 删除配置文件
    for (const t of existing) {
      try {
        fs.rmSync(t.path(), { force: true });
        console.log(`${C.green}  ✓ 已删除 ${t.label}${C.reset}`);
      } catch (e) {
        console.log(`${C.red}  ✗ 删除失败: ${e.message}${C.reset}`);
      }
    }
  }

  // ── 运行 onboard 向导 ─────────────────────────────────────
  console.log('');
  console.log(`${C.cyan}  启动 onboard 向导...${C.reset}`);
  console.log('');

  spawnSync(env.OC_NODE, [env.OC_OPENCLAW_MJS, 'onboard'], {
    stdio: 'inherit',
    env: { ...process.env, OPENCLAW_HOME: env.OC_HOME },
  });

  // onboard 可能因上游 bug 导致 openclaw.json 未写入，但其他配置已完成
  // 以 auth-profiles.json 为主要判断依据
  const configOk = fs.existsSync(env.OC_CONFIG);
  const authOk   = fs.existsSync(path.join(env.OC_OPENCLAW_DIR, 'agents', 'main', 'agent', 'auth-profiles.json'));

  console.log('');
  if (authOk) {
    if (!configOk) {
      // onboard bug：auth 写入了但 openclaw.json 没写，自动补全
      console.log(`${C.yellow}  ⚠ 检测到 onboard 向导未完整写入 openclaw.json（已知上游 bug），正在自动修复...${C.reset}`);
      try {
        const { execFileSync: exec } = require('child_process');
        exec(env.OC_NODE, [env.OC_OPENCLAW_MJS, 'config', 'get', 'gateway.mode'], {
          stdio: 'ignore', env: { ...process.env, OPENCLAW_HOME: env.OC_HOME },
        });
      } catch {}
    }
    console.log(`${C.green}  ✓ 配置完成，请选择菜单 [4] 启动 Gateway。${C.reset}`);
    console.log(`${C.gray}  提示：Telegram 配置完成后，在 bot 里发送 /start 开始配对。${C.reset}`);
  } else {
    console.log(`${C.red}  ✗ 配置未完成，请重新运行 [6]。${C.reset}`);
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
