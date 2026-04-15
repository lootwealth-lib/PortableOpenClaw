#!/usr/bin/env node
// menu.js - 跨平台交互菜单（替代 Menu.ps1）

'use strict';

const path     = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');

const env = require('./env.js');

const SCRIPTS = {
  '1': { label: 'Node.js 环境初始化（前置依赖）',     file: 'init-nodejs.js',      color: 'green'  },
  '2': { label: 'OpenClaw 安装 / 检测',               file: 'install-openclaw.js', color: 'green'  },
  '3': { label: 'OpenClaw 运行状态',                  file: 'status.js',           color: 'green'  },
  '4': { label: 'OpenClaw 启动 / 停止',               file: 'toggle.js',           color: 'green'  },
  '5': { label: '一键清除（Node.js / OpenClaw）',     file: 'clear-all.js',        color: 'red'    },
  '6': { label: '重新配置（API Key / Telegram 等）',  file: 'reconfigure.js',      color: 'yellow' },
};

// ANSI 颜色
const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

function showMenu() {
  console.clear();
  console.log(`${C.cyan}========================================${C.reset}`);
  console.log(`${C.yellow}       OpenClaw 便捷工具箱 v1.0        ${C.reset}`);
  console.log(`${C.cyan}========================================${C.reset}`);
  console.log('');
  for (const [k, v] of Object.entries(SCRIPTS)) {
    const c = v.color === 'red' ? C.red : v.color === 'yellow' ? C.yellow : C.green;
    console.log(`  ${c}[${k}] ${v.label}${C.reset}`);
  }
  console.log('');
  console.log(`  ${C.red}[0] 退出${C.reset}`);
  console.log(`${C.cyan}========================================${C.reset}`);
}

function runScript(file) {
  const target = path.join(__dirname, file);
  console.log(`\n${C.cyan}正在执行: ${file} ...${C.reset}\n`);
  // 用当前 node（已是便携版）运行子脚本
  const result = spawnSync(process.execPath, [target], {
    stdio: 'inherit',
    env: { ...process.env, OPENCLAW_HOME: env.OC_HOME },
  });
  if (result.error) {
    console.error(`${C.red}执行失败: ${result.error.message}${C.reset}`);
  }
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  // Windows 路径特殊字符警告（openclaw gateway 上游 bug）
  if (env.IS_WIN && /[&$%!^]/.test(env.OC_ROOT)) {
    console.log(`\n${C.yellow}  ⚠ 警告：项目路径含特殊字符 (& $ % ! ^)${C.reset}`);
    console.log(`${C.yellow}    路径: ${env.OC_ROOT}${C.reset}`);
    console.log(`${C.yellow}    OpenClaw Gateway 启动将失败，建议将项目移到无特殊字符的目录${C.reset}\n`);
  }

  while (true) {
    showMenu();
    const choice = await prompt('请输入选项编号: ');
    if (choice === '0') {
      console.log(`${C.yellow}再见！${C.reset}`);
      process.exit(0);
    }
    if (SCRIPTS[choice]) {
      runScript(SCRIPTS[choice].file);
      await prompt(`\n${C.gray}按 Enter 返回菜单...${C.reset}`);
    } else {
      console.log(`${C.red}无效选项，请重新选择。${C.reset}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
