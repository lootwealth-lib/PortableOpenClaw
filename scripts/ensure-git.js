#!/usr/bin/env node
// ensure-git.js - 跨平台确保 git 可用
// Windows：自动下载 MinGit（便携版，~30MB，解压即用）
// Linux/macOS：检测系统 git，没有则提示用包管理器安装

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const env = require('./env.js');

const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

const MINGIT_DIR = path.join(env.OC_ROOT, 'mingit');
const MINGIT_EXE = path.join(MINGIT_DIR, 'cmd', 'git.exe');

// npmmirror 国内镜像（首选）
const NPMMIRROR_BASE = 'https://registry.npmmirror.com/-/binary/git-for-windows';
// GitHub 官方（fallback）
const GITHUB_BASE = 'https://github.com/git-for-windows/git/releases/download';

// ── 检测 git 是否真正可用 ─────────────────────────────────
function checkGit(gitPath) {
  try {
    const r = spawnSync(gitPath, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (r.status === 0 && r.stdout && r.stdout.includes('git')) {
      return { ok: true, path: gitPath, ver: r.stdout.trim() };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function findGit() {
  // 1. 便携 MinGit
  if (env.IS_WIN && fs.existsSync(MINGIT_EXE)) {
    const r = checkGit(MINGIT_EXE);
    if (r.ok) return r;
  }
  // 2. 系统 git
  return checkGit('git');
}

// ── 从 tag 推导文件名中的版本号 ──────────────────────────
// tag: v2.53.0.windows.3  →  fileVer: 2.53.0.3
// tag: v2.47.1.windows.2  →  fileVer: 2.47.1.2
function tagToFileVer(tag) {
  // 去掉前缀 v，把 .windows.N 替换成 .N
  return tag.replace(/^v/, '').replace(/\.windows\.(\d+)$/, '.$1');
}

// ── 查询最新版本（npmmirror API，fallback GitHub API）────
function fetchLatestVersion() {
  return new Promise((resolve) => {
    httpsGet(`${NPMMIRROR_BASE}`, 8000, (err, data) => {
      if (!err && data) {
        try {
          const list = JSON.parse(data);
          // 取最后一个不含 rc/prerelease 的稳定版
          const stable = [...list]
            .reverse()
            .find(e => e.name && /^v\d+\.\d+\.\d+\.windows\.\d+\/$/.test(e.name));
          if (stable) {
            const tag    = stable.name.replace(/\/$/, ''); // v2.53.0.windows.3
            const fileVer = tagToFileVer(tag);              // 2.53.0.3
            return resolve({ tag, fileVer, source: 'npmmirror' });
          }
        } catch {}
      }
      // fallback: GitHub API
      httpsGet('https://api.github.com/repos/git-for-windows/git/releases/latest', 10000, (err2, data2) => {
        if (!err2 && data2) {
          try {
            const json    = JSON.parse(data2);
            const tag     = json.tag_name;       // v2.53.0.windows.3
            const fileVer = tagToFileVer(tag);   // 2.53.0.3
            return resolve({ tag, fileVer, source: 'github' });
          } catch {}
        }
        // 最终 fallback：硬编码已知稳定版
        resolve({ tag: 'v2.53.0.windows.3', fileVer: '2.53.0.3', source: 'fallback' });
      }, { 'User-Agent': 'openclaw-portable' });
    });
  });
}

// ── 构建下载 URL（优先 npmmirror）────────────────────────
function buildUrls(tag, fileVer) {
  const filename = `MinGit-${fileVer}-busybox-64-bit.zip`;
  return [
    `${NPMMIRROR_BASE}/${tag}/${filename}`,   // 国内镜像首选
    `${GITHUB_BASE}/${tag}/${filename}`,       // GitHub 官方 fallback
  ];
}

// ── 通用 HTTPS GET（支持重定向）──────────────────────────
function httpsGet(url, timeout, callback, extraHeaders = {}) {
  function get(u, redirects) {
    if (redirects > 5) return callback(new Error('重定向次数过多'));
    const mod = u.startsWith('https') ? https : require('http');
    const req = mod.get(u, {
      headers: { 'User-Agent': 'openclaw-portable', ...extraHeaders },
      timeout,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume();
        return get(res.headers.location, redirects + 1);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return callback(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => callback(null, data));
      res.on('error', callback);
    });
    req.on('error', callback);
    req.on('timeout', () => { req.destroy(); callback(new Error('请求超时')); });
  }
  get(url, 0);
}

// ── 下载文件到磁盘（带进度，确保流关闭后 resolve）────────
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    function get(u, redirects) {
      if (redirects > 5) return reject(new Error('重定向次数过多'));
      const mod = u.startsWith('https') ? https : require('http');
      const req = mod.get(u, { headers: { 'User-Agent': 'openclaw-portable' }, timeout: 60000 }, res => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          res.resume();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}: ${u}`));
        }
        const total = parseInt(res.headers['content-length'] || '0');
        let received = 0;

        // 关键：等待 finish 事件确保文件完全写入并关闭
        const out = fs.createWriteStream(dest);
        out.on('error', reject);
        out.on('finish', () => {
          process.stdout.write('\n');
          resolve();
        });

        res.on('data', chunk => {
          received += chunk.length;
          if (total > 0) {
            const pct = Math.round(received / total * 100);
            const mb  = (received / 1024 / 1024).toFixed(1);
            const tot = (total / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r${C.gray}        ${pct}% (${mb}/${tot} MB)  ${C.reset}`);
          }
          out.write(chunk);
        });
        res.on('end', () => out.end()); // 触发 finish
        res.on('error', err => { out.destroy(); reject(err); });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('下载超时')); });
    }
    get(url, 0);
  });
}

// ── 解压 zip（PowerShell Expand-Archive）────────────────
function unzipWindows(zipPath, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  // 用单引号包裹路径，避免特殊字符问题；路径中的单引号用 '' 转义
  const safeSrc  = zipPath.replace(/'/g, "''");
  const safeDest = destDir.replace(/'/g, "''");
  const r = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -LiteralPath '${safeSrc}' -DestinationPath '${safeDest}' -Force`,
  ], { stdio: 'inherit', timeout: 120000 });
  if (r.status !== 0) throw new Error('PowerShell Expand-Archive 失败');
}

// ── 配置 git 强制走 HTTPS ─────────────────────────────────
function configureGitHttps(gitExe) {
  spawnSync(gitExe, ['config', '--global', 'url.https://github.com/.insteadOf', 'git@github.com:'],
    { stdio: 'ignore' });
  spawnSync(gitExe, ['config', '--global', 'url.https://github.com/.insteadOf', 'ssh://git@github.com/'],
    { stdio: 'ignore' });
}

// ── 主函数 ────────────────────────────────────────────────
async function ensureGitAsync() {
  // 已有 git 直接返回
  const existing = findGit();
  if (existing.ok) {
    console.log(`${C.gray}  ✓ ${existing.ver}${C.reset}`);
    configureGitHttps(existing.path);
    return existing.path;
  }

  // Linux/macOS 不自动安装
  if (!env.IS_WIN) {
    console.log(`${C.red}  ✗ 未检测到 git${C.reset}`);
    console.log('');
    if (process.platform === 'darwin') {
      console.log(`${C.cyan}  安装方式（任选一）：${C.reset}`);
      console.log(`${C.gray}    xcode-select --install${C.reset}`);
      console.log(`${C.gray}    brew install git${C.reset}`);
    } else {
      console.log(`${C.cyan}  安装方式：${C.reset}`);
      console.log(`${C.gray}    sudo apt install git    # Ubuntu/Debian${C.reset}`);
      console.log(`${C.gray}    sudo yum install git    # CentOS/RHEL${C.reset}`);
      console.log(`${C.gray}    sudo pacman -S git      # Arch${C.reset}`);
    }
    console.log('');
    throw new Error('GIT_NOT_FOUND');
  }

  // Windows：自动下载 MinGit
  console.log(`${C.yellow}  未检测到 git，自动下载便携版 MinGit...${C.reset}`);
  console.log('');

  // 1. 查询版本
  console.log(`${C.cyan}  [1/3] 查询最新 MinGit 版本...${C.reset}`);
  const { tag, fileVer, source } = await fetchLatestVersion();
  const filename = `MinGit-${fileVer}-busybox-64-bit.zip`;
  console.log(`${C.gray}        ${filename}  (via ${source})${C.reset}`);

  // 2. 下载（先试 npmmirror，失败再试 GitHub）
  const urls = buildUrls(tag, fileVer);
  const zipPath = path.join(env.OC_ROOT, filename);

  // 清理可能存在的残留文件
  if (fs.existsSync(zipPath)) {
    try { fs.unlinkSync(zipPath); } catch {}
  }

  console.log(`${C.cyan}  [2/3] 下载 ${filename} ...${C.reset}`);

  let downloaded = false;
  for (const url of urls) {
    const label = url.includes('npmmirror') ? 'npmmirror（国内）' : 'GitHub（官方）';
    console.log(`${C.gray}        尝试 ${label}${C.reset}`);
    try {
      await downloadFile(url, zipPath);
      const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
      console.log(`${C.gray}        下载完成 (${sizeMB} MB)${C.reset}`);
      downloaded = true;
      break;
    } catch (e) {
      console.log(`${C.yellow}        失败: ${e.message}，尝试下一个源...${C.reset}`);
      if (fs.existsSync(zipPath)) {
        try { fs.unlinkSync(zipPath); } catch {}
      }
    }
  }

  if (!downloaded) {
    throw new Error('所有下载源均失败，请检查网络连接');
  }

  // 3. 解压
  console.log(`${C.cyan}  [3/3] 解压到 ${MINGIT_DIR} ...${C.reset}`);
  try {
    unzipWindows(zipPath, MINGIT_DIR);
  } finally {
    // 无论成功失败都删除 zip
    if (fs.existsSync(zipPath)) {
      try { fs.unlinkSync(zipPath); } catch {}
    }
  }
  console.log(`${C.gray}        解压完成${C.reset}`);

  // 4. 验证
  const result = checkGit(MINGIT_EXE);
  if (!result.ok) {
    throw new Error(`MinGit 安装后仍无法运行，请检查 ${MINGIT_DIR} 目录结构`);
  }

  console.log(`${C.green}  ✓ MinGit 安装完成：${result.ver}${C.reset}`);
  configureGitHttps(MINGIT_EXE);

  // 注入 PATH
  const gitBinDir = path.join(MINGIT_DIR, 'cmd');
  if (!process.env.PATH.includes(gitBinDir)) {
    process.env.PATH = `${gitBinDir};${process.env.PATH}`;
  }

  return MINGIT_EXE;
}

module.exports = { ensureGitAsync, findGit, MINGIT_DIR, MINGIT_EXE };

if (require.main === module) {
  ensureGitAsync()
    .then(p => console.log(`${C.green}  git: ${p}${C.reset}`))
    .catch(e => {
      if (e.message !== 'GIT_NOT_FOUND') console.error(`${C.red}  ${e.message}${C.reset}`);
      process.exit(1);
    });
}
