#!/usr/bin/env node
// install-openclaw.js - 菜单 [2]：OpenClaw 安装 / 检测

'use strict';

const fs   = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const env       = require('./env.js');
const { ensureGitAsync } = require('./ensure-git.js');

const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

async function main() {

console.log('');
console.log(`${C.yellow}===== OpenClaw 安装检测 =====${C.reset}`);
console.log('');

// ── 1. Node.js 检查 ────────────────────────────────────────
if (!env.OC_NODE_READY) {
  console.log(`${C.red}  ✗ Node.js 未就绪，请先运行菜单 [1]${C.reset}`);
  process.exit(1);
}
console.log(`${C.gray}  ✓ Node.js ${env.OC_NODE_VER}${C.reset}`);

// ── 2. 已安装则直接返回 ────────────────────────────────────
console.log('');
console.log(`${C.cyan}  检测 OpenClaw...${C.reset}`);

if (env.OC_OPENCLAW_READY) {
  console.log(`${C.green}  ✓ OpenClaw 已安装：${env.OC_OPENCLAW_VER}${C.reset}`);
  console.log(`${C.gray}    路径：${env.OC_OPENCLAW_MJS}${C.reset}`);
  env.ocLog(`OpenClaw ${env.OC_OPENCLAW_VER} 检测通过`);
  console.log('');
  process.exit(0);
}

console.log(`${C.yellow}  未检测到 OpenClaw，开始安装最新版...${C.reset}`);
console.log('');

// ── 3. 确保 git 可用（Windows 自动下载 MinGit）────────────
// openclaw 依赖 @whiskeysockets/baileys → libsignal@git+https://github.com/...
// npm install 时必须调用 git ls-remote
console.log(`${C.cyan}  检测 git...${C.reset}`);
let gitExe;
try {
  gitExe = await ensureGitAsync();
} catch (e) {
  if (e.message !== 'GIT_NOT_FOUND') {
    console.log(`${C.red}  ✗ git 准备失败: ${e.message}${C.reset}`);
  }
  process.exit(1);
}

// 确保 git 在 PATH 中（MinGit 的 cmd 目录）
const gitDir = path.dirname(gitExe);
if (!process.env.PATH.includes(gitDir)) {
  process.env.PATH = `${gitDir}${env.IS_WIN ? ';' : ':'}${process.env.PATH}`;
}

// 确保便携 node 在 PATH 中（npm postinstall 脚本需要能找到 node）
// Windows 上 npm 通过 cmd.exe /c 执行 postinstall，必须确保 PATH 在 npmEnv 里已包含 node 目录
// （process.env.PATH 修改对 cmd.exe 子进程无效，必须在 spawnSync 的 env 参数里传入）
if (env.OC_NODE_DIR && !process.env.PATH.toLowerCase().includes(env.OC_NODE_DIR.toLowerCase())) {
  process.env.PATH = `${env.OC_NODE_DIR}${env.IS_WIN ? ';' : ':'}${process.env.PATH}`;
}

// ── 4. npm 配置 ────────────────────────────────────────────
// prefix 按平台分目录，与 env.js 保持一致
const ocPrefix = path.join(env.OC_ROOT, 'openclaw', env.IS_WIN ? 'win' : 'unix');
console.log('');
if (!fs.existsSync(ocPrefix)) fs.mkdirSync(ocPrefix, { recursive: true });

const npmEnv = {
  ...process.env,
  OPENCLAW_HOME: env.OC_HOME,
  npm_config_prefix: ocPrefix,
  npm_config_registry: 'https://registry.npmmirror.com',
  // 显式把便携 node 放到 PATH 最前面，确保 postinstall 脚本（通过 cmd.exe 执行）能找到 node
  PATH: `${env.OC_NODE_DIR}${env.IS_WIN ? ';' : ':'}${gitDir}${env.IS_WIN ? ';' : ':'}${process.env.PATH}`,
  // npm 长路径支持（Windows）
  ...(env.IS_WIN ? { npm_config_long_paths: 'true' } : {}),
};

// Windows 长路径支持（openclaw 嵌套 node_modules 路径超过 260 字符）
if (env.IS_WIN) {
  try {
    const { execFileSync: exec } = require('child_process');
    exec('reg', ['add', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
      '/v', 'LongPathsEnabled', '/t', 'REG_DWORD', '/d', '1', '/f'], { stdio: 'ignore' });
    console.log(`${C.gray}  ✓ Windows 长路径支持已启用${C.reset}`);
  } catch {
    console.log(`${C.yellow}  ⚠ 无法启用长路径支持（需要管理员权限），安装可能出现路径过长警告${C.reset}`);
  }
}

console.log(`${C.cyan}  设置 npm prefix: ${ocPrefix}${C.reset}`);
// 只用环境变量控制 prefix，不写全局 .npmrc（避免污染）
// npm_config_prefix 已在 npmEnv 中设置

// ── 6. 执行安装（捕获 stderr 用于错误分析）────────────────
console.log(`${C.cyan}  执行 npm install -g openclaw@latest ...${C.reset}`);
console.log(`${C.gray}  （首次安装需要编译原生模块，可能需要几分钟，请耐心等待）${C.reset}`);
console.log('');

const installResult = spawnSync(
  env.OC_NODE,
  [env.OC_NPM_CLI, 'install', '-g', 'openclaw@latest', '--progress'],
  { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8', env: npmEnv }
);

const stderr = installResult.stderr || '';

if (installResult.status !== 0) {
  console.log('');
  console.log(`${C.red}  ✗ 安装失败${C.reset}`);

  // 针对性错误提示
  if (stderr.includes('xcode-select') || stderr.includes('No developer tools')) {
    console.log(`${C.yellow}  原因：macOS 未安装 Xcode Command Line Tools${C.reset}`);
    console.log(`${C.cyan}  修复：xcode-select --install${C.reset}`);
  } else if (stderr.includes('Permission denied (publickey)') || stderr.includes('git@github.com')) {
    console.log(`${C.yellow}  原因：git SSH 认证失败${C.reset}`);
    console.log(`${C.cyan}  修复：已自动配置 HTTPS，请重新运行此选项${C.reset}`);
  } else if (stderr.includes('ENOTFOUND') || stderr.includes('getaddrinfo') || stderr.includes('network')) {
    console.log(`${C.yellow}  原因：网络连接失败，无法访问 GitHub${C.reset}`);
    console.log(`${C.cyan}  建议：检查网络或配置代理后重试${C.reset}`);
  } else if (stderr.includes('code 128') || stderr.includes('git error')) {
    console.log(`${C.yellow}  原因：git 操作失败（可能是网络问题或 GitHub 访问受限）${C.reset}`);
    console.log(`${C.cyan}  建议：确保能访问 github.com，或配置代理后重试${C.reset}`);
  } else if (stderr.includes('EACCES') || stderr.includes('permission denied')) {
    console.log(`${C.yellow}  原因：权限不足${C.reset}`);
    console.log(`${C.cyan}  建议：检查 ${ocPrefix} 目录权限${C.reset}`);
  }

  if (stderr.trim()) {
    console.log('');
    console.log(`${C.gray}  错误详情：${C.reset}`);
    // 只显示最后 10 行
    const lines = stderr.trim().split('\n').slice(-10);
    lines.forEach(l => console.log(`${C.gray}    ${l}${C.reset}`));
  }
  console.log('');
  process.exit(1);
}

// ── 7. 验证安装结果 ────────────────────────────────────────
const { IS_WIN, OC_ROOT, OC_HOME, OC_OPENCLAW_DIR, OC_CONFIG } = env;
const ocShim = IS_WIN
  ? path.join(ocPrefix, 'openclaw.cmd')
  : path.join(ocPrefix, 'bin', 'openclaw');
const ocMjs = IS_WIN
  ? path.join(ocPrefix, 'node_modules/openclaw/openclaw.mjs')
  : path.join(ocPrefix, 'lib/node_modules/openclaw/openclaw.mjs');
if (!fs.existsSync(ocShim)) {
  console.log(`${C.red}  ✗ 安装后未找到 openclaw，请检查 npm 输出。${C.reset}`);
  process.exit(1);
}

let ver = 'unknown';
try {
  ver = execFileSync(env.OC_NODE, [ocMjs, '--version'], {
    encoding: 'utf8',
    env: { ...process.env, OPENCLAW_HOME: OC_HOME },
  }).trim();
} catch {}

console.log(`${C.green}  ✓ OpenClaw ${ver} 安装完成${C.reset}`);
env.ocLog(`OpenClaw ${ver} 安装完成`);

// ── 8. 生成初始配置（若尚未配置）─────────────────────────
if (!fs.existsSync(OC_CONFIG)) {
  console.log('');
  console.log(`${C.cyan}  生成便携配置文件...${C.reset}`);
  console.log(`${C.gray}    目录: ${OC_HOME}${C.reset}`);
  if (!fs.existsSync(OC_HOME)) fs.mkdirSync(OC_HOME, { recursive: true });

  spawnSync(
    env.OC_NODE,
    [ocMjs, 'onboard', '--non-interactive', '--skip-health', '--accept-risk'],
    { stdio: 'inherit', env: { ...process.env, OPENCLAW_HOME: OC_HOME } }
  );

  if (fs.existsSync(OC_CONFIG)) {
    console.log(`${C.green}  ✓ 配置文件已生成：${OC_CONFIG}${C.reset}`);
    // 修正 onboard 写入的绝对路径
    try {
      const cfg = JSON.parse(fs.readFileSync(OC_CONFIG, 'utf8'));
      const expectedWorkspace = path.join(OC_OPENCLAW_DIR, 'workspace');
      if (cfg?.agents?.defaults?.workspace &&
          cfg.agents.defaults.workspace !== expectedWorkspace) {
        cfg.agents.defaults.workspace = expectedWorkspace;
        fs.writeFileSync(OC_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
        console.log(`${C.gray}  ✓ workspace 路径已修正为相对当前目录${C.reset}`);
      }
    } catch {}
  } else {
    console.log(`${C.yellow}  ⚠ 配置文件生成失败，请手动运行：${C.reset}`);
    console.log(`${C.gray}    openclaw onboard --non-interactive --skip-health --accept-risk${C.reset}`);
  }
} else {
  console.log(`${C.gray}  ✓ 配置文件已存在，跳过初始化${C.reset}`);
}

console.log('');
} // end main()

main().catch(e => { console.error(`${C.red}  错误: ${e.message}${C.reset}`); process.exit(1); });
