#!/usr/bin/env node
// init-nodejs.js - 菜单 [1]：Node.js 环境信息

'use strict';

const { execFileSync } = require('child_process');
const env = require('./env.js');

const C = {
  reset:  '\x1b[0m',
  yellow: '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

console.log('');
console.log(`${C.yellow}===== Node.js 环境信息 =====${C.reset}`);
console.log('');

if (!env.OC_NODE_READY) {
  console.log(`${C.red}  ✗ 未检测到便携 Node.js${C.reset}`);
  console.log(`${C.gray}  请通过入口脚本（OpenClaw.bat / openclaw.sh）启动，入口会自动安装 Node.js${C.reset}`);
  process.exit(1);
}

console.log(`${C.green}  ✓ Node.js : ${env.OC_NODE_VER}${C.reset}`);
console.log(`${C.green}    路径    : ${env.OC_NODE}${C.reset}`);

// npm 版本
try {
  const npmVer = execFileSync(env.OC_NODE, [env.OC_NPM_CLI, '--version'], { encoding: 'utf8' }).trim();
  console.log(`${C.green}    npm     : v${npmVer}${C.reset}`);
} catch {
  console.log(`${C.gray}    npm     : 无法获取版本${C.reset}`);
}

console.log('');
console.log(`${C.gray}  如需重装，请手动删除 ${env.OC_NODE_DIR} 后重新运行入口脚本。${C.reset}`);
console.log('');
