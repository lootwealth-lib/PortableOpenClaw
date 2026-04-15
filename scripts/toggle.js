#!/usr/bin/env node
// toggle.js - 菜单 [4]：启动 / 停止 OpenClaw Gateway

'use strict';

const fs       = require('fs');
const path     = require('path');
const http     = require('http');
const readline = require('readline');
const { spawn, spawnSync, execFileSync } = require('child_process');

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

function killProcesses(procs) {
  for (const p of procs) {
    try {
      if (env.IS_WIN) {
        execFileSync('taskkill', ['/PID', String(p.pid), '/F'], { stdio: 'ignore' });
      } else {
        process.kill(p.pid, 'SIGTERM');
      }
      console.log(`${C.green}  ✓ 已停止 PID ${p.pid}${C.reset}`);
    } catch (e) {
      console.log(`${C.red}  ✗ 停止 PID ${p.pid} 失败: ${e.message}${C.reset}`);
    }
  }
}

function waitForGateway(timeoutSec = 120) {
  return new Promise(resolve => {
    let elapsed = 0;
    process.stdout.write(`${C.gray}  等待 Gateway 就绪（最长 ${timeoutSec}s，首次启动需加载大量模块请耐心等待）`);
    const timer = setInterval(() => {
      elapsed++;
      process.stdout.write('.');
      const req = http.get('http://127.0.0.1:18789/', { timeout: 1000 }, res => {
        if (res.statusCode < 500) {
          clearInterval(timer);
          process.stdout.write('\n');
          resolve(true);
        }
        res.resume();
      });
      req.on('error', () => {});
      req.end();
      if (elapsed >= timeoutSec) {
        clearInterval(timer);
        process.stdout.write('\n');
        resolve(false);
      }
    }, 1000);
  });
}

function openUrl(url) {
  try {
    if (env.IS_WIN) {
      spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
    } else {
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {}
}

function readToken() {
  try {
    const cfg = JSON.parse(fs.readFileSync(env.OC_CONFIG, 'utf8'));
    return cfg?.gateway?.auth?.token || '';
  } catch { return ''; }
}

function patchConfig() {
  if (!fs.existsSync(env.OC_CONFIG)) return;
  try {
    const raw = fs.readFileSync(env.OC_CONFIG, 'utf8');
    const cfg = JSON.parse(raw);
    const expectedWorkspace = path.join(env.OC_OPENCLAW_DIR, 'workspace');
    let changed = false;
    if (cfg?.agents?.defaults?.workspace &&
        cfg.agents.defaults.workspace !== expectedWorkspace) {
      console.log(`${C.gray}  修正 workspace 路径...${C.reset}`);
      cfg.agents.defaults.workspace = expectedWorkspace;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(env.OC_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
      console.log(`${C.gray}  ✓ 配置路径已更新${C.reset}`);
    }
  } catch (e) {
    console.log(`${C.yellow}  ⚠ 修正配置路径失败: ${e.message}${C.reset}`);
  }
}

function startGateway() {
  const ocMjs = env.OC_OPENCLAW_MJS;
  if (env.IS_WIN) {
    const batFile = path.join(env.OC_ROOT, '_gateway_start.bat');
    const batContent = [
      '@echo off',
      'title OpenClaw Gateway',
      `set "OPENCLAW_HOME=${env.OC_HOME}"`,
      `"${env.OC_NODE}" "${ocMjs}" gateway run`,
      'echo.',
      'pause',
    ].join('\r\n');
    fs.writeFileSync(batFile, batContent, 'utf8');
    spawn('cmd.exe', ['/c', 'start', 'OpenClaw Gateway', batFile], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else {
    const nodeExe = env.OC_NODE;
    const launched = tryLaunchInTerminal(nodeExe, ocMjs);
    if (!launched) {
      const logFile = path.join(env.OC_LOG_DIR, 'gateway.log');
      const out = fs.openSync(logFile, 'a');
      spawn(nodeExe, [ocMjs, 'gateway', 'run'], {
        detached: true,
        stdio: ['ignore', out, out],
        env: { ...process.env, OPENCLAW_HOME: env.OC_HOME },
      }).unref();
      console.log(`${C.gray}  Gateway 日志：${logFile}${C.reset}`);
    }
  }
}

function tryLaunchInTerminal(nodeExe, ocMjs) {
  const cmd = `"${nodeExe}" "${ocMjs}" gateway run`;
  const terminals = [
    ['osascript', ['-e', `tell application "Terminal" to do script "${cmd.replace(/"/g, '\\"')}"`]],
    ['gnome-terminal', ['--', 'bash', '-c', `${cmd}; read -p 'Press Enter to close...'`]],
    ['konsole', ['-e', 'bash', '-c', `${cmd}; read -p 'Press Enter to close...'`]],
    ['xterm', ['-e', `bash -c '${cmd}; read -p "Press Enter to close..."'`]],
  ];
  for (const [bin, args] of terminals) {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' });
      spawn(bin, args, { detached: true, stdio: 'ignore' }).unref();
      return true;
    } catch {}
  }
  return false;
}

/** 检测配置是否完整（auth-profiles.json 存在即视为已配置） */
function isConfigured() {
  const authProfiles = path.join(env.OC_OPENCLAW_DIR, 'agents', 'main', 'agent', 'auth-profiles.json');
  return fs.existsSync(authProfiles);
}

/** 运行交互式 onboard 向导 */
function runOnboard() {
  console.log('');
  console.log(`${C.cyan}  启动 onboard 向导...${C.reset}`);
  console.log('');
  spawnSync(env.OC_NODE, [env.OC_OPENCLAW_MJS, 'onboard'], {
    stdio: 'inherit',
    env: { ...process.env, OPENCLAW_HOME: env.OC_HOME },
  });
}

async function main() {
  console.log('');
  console.log(`${C.yellow}===== OpenClaw 启动 / 停止 =====${C.reset}`);

  if (!env.OC_NODE_READY) {
    console.log(`${C.red}  ✗ Node.js 未就绪，请先运行菜单 [1]${C.reset}`);
    process.exit(1);
  }
  if (!env.OC_OPENCLAW_READY) {
    console.log(`${C.red}  ✗ OpenClaw 未安装，请先运行菜单 [2]${C.reset}`);
    process.exit(1);
  }

  if (env.IS_WIN && /[&$%!^]/.test(env.OC_ROOT)) {
    console.log(`${C.red}  ✗ 项目路径含特殊字符，OpenClaw Gateway 无法启动${C.reset}`);
    console.log(`${C.yellow}    当前路径: ${env.OC_ROOT}${C.reset}`);
    console.log(`${C.cyan}    请将项目移到不含 & $ % ! ^ 等特殊字符的目录下${C.reset}`);
    process.exit(1);
  }

  // ── 检测运行状态 ─────────────────────────────────────────
  console.log('');
  const procs = findOCProcesses();

  if (procs.length > 0) {
    console.log(`${C.green}  ● OpenClaw 运行中 (PID: ${procs.map(p => p.pid).join(', ')})${C.reset}`);
    const ans = await ask('  是否停止？[y/N] ');
    if (/^[Yy]/.test(ans)) {
      killProcesses(procs);
      env.ocLog('OpenClaw 已手动停止');
    } else {
      console.log(`${C.gray}  已取消。${C.reset}`);
    }
    console.log('');
    return;
  }

  console.log(`${C.gray}  ○ OpenClaw 未运行${C.reset}`);
  console.log('');

  // ── 检测配置 ─────────────────────────────────────────────
  if (!isConfigured()) {
    console.log(`${C.yellow}  ⚠ 未检测到完整配置（AI provider / 通道未设置）。${C.reset}`);
    console.log(`${C.cyan}  需要先运行 onboard 向导完成配置。${C.reset}`);
    const ans = await ask('  现在运行 onboard 向导？[Y/n] ');
    if (/^[Nn]/.test(ans)) {
      console.log(`${C.gray}  已取消。${C.reset}`);
      console.log('');
      return;
    }
    runOnboard();

    const authOk = fs.existsSync(path.join(env.OC_OPENCLAW_DIR, 'agents', 'main', 'agent', 'auth-profiles.json'));
    console.log('');
    if (!authOk) {
      console.log(`${C.yellow}  ⚠ AI provider 配置未完成（onboard 向导中途出错）。${C.reset}`);
      console.log(`${C.cyan}    请在 Dashboard → AI 与代理 → Models 里手动添加，${C.reset}`);
      console.log(`${C.cyan}    或运行菜单 [6] 重新配置。${C.reset}`);
    } else {
      console.log(`${C.green}  ✓ 配置完成，请重新选择 [4] 启动 Gateway。${C.reset}`);
    }
    console.log(`${C.gray}  提示：Telegram 配置完成后，在 bot 里发送 /start 开始配对。${C.reset}`);
    console.log('');
    return;
  }

  // ── 有配置，直接启动 ─────────────────────────────────────
  const ans = await ask('  检测到配置，直接启动 Gateway？[Y/n] ');
  if (/^[Nn]/.test(ans)) {
    console.log(`${C.gray}  已取消。${C.reset}`);
    console.log('');
    return;
  }

  console.log(`${C.cyan}  正在启动 OpenClaw Gateway...${C.reset}`);
  patchConfig();
  startGateway();

  const ready = await waitForGateway(120);
  if (ready) {
    console.log(`${C.green}  ✓ Gateway 已就绪${C.reset}`);
    env.ocLog('OpenClaw Gateway 已启动');
    const token = readToken();
    const dashUrl = token
      ? `http://127.0.0.1:18789/#token=${token}`
      : 'http://127.0.0.1:18789/';
    console.log(`${C.cyan}  Dashboard: ${dashUrl}${C.reset}`);
    openUrl(dashUrl);
  } else {
    console.log(`${C.yellow}  ⚠ 120 秒内未检测到响应，请查看 Gateway 窗口。${C.reset}`);
    console.log(`${C.gray}    可手动访问: http://127.0.0.1:18789/${C.reset}`);
  }

  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
