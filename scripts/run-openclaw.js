#!/usr/bin/env node
// run-openclaw.js - 命令行透传入口
// 用法：claw.bat [参数]  /  claw.sh [参数]
// 示例：claw.bat --version
//        claw.bat gateway run
//        claw.bat onboard --non-interactive --skip-health --accept-risk

'use strict';

const { spawnSync } = require('child_process');
const env = require('./env.js');

const C = { red: '\x1b[31m', reset: '\x1b[0m' };

if (!env.OC_NODE_READY) {
  console.error(`${C.red}✗ Node.js 未就绪，请先运行入口脚本完成初始化${C.reset}`);
  process.exit(1);
}

if (!env.OC_OPENCLAW_READY) {
  console.error(`${C.red}✗ OpenClaw 未安装，请先运行菜单 [2]${C.reset}`);
  process.exit(1);
}

// process.argv: [node, run-openclaw.js, ...用户参数]
const args = process.argv.slice(2);

const result = spawnSync(
  env.OC_NODE,
  args.length > 0 ? [env.OC_OPENCLAW_MJS, ...args] : [env.OC_OPENCLAW_MJS, '--help'],
  {
    stdio: 'inherit',
    env: { ...process.env, OPENCLAW_HOME: env.OC_HOME },
  }
);

process.exit(result.status ?? 0);
