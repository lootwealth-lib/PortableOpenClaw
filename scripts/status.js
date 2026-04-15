#!/usr/bin/env node
// status.js - 菜单 [3]：OpenClaw 运行状态

'use strict';

const { execFileSync } = require('child_process');
const env = require('./env.js');

const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  gray:   '\x1b[90m',
};

/**
 * 查找正在运行的 openclaw 进程，返回 [{ pid, mem }] 或 []
 */
function findOCProcesses() {
  try {
    if (env.IS_WIN) {
      // WMIC CSV 实际列顺序：Node(hostname), CommandLine, ProcessId, WorkingSetSize
      const out = execFileSync(
        'wmic',
        ['process', 'where', "name='node.exe'", 'get', 'CommandLine,ProcessId,WorkingSetSize', '/format:csv'],
        { encoding: 'utf8', timeout: 5000 }
      );
      return out.split('\n')
        .filter(l => l.includes('openclaw') && !l.startsWith('Node'))
        .map(l => {
          const parts = l.trim().split(',');
          // csv: Node, CommandLine, ProcessId, WorkingSetSize
          if (parts.length < 4) return null;
          const pid = parseInt(parts[parts.length - 2]);
          const mem = Math.round(parseInt(parts[parts.length - 1]) / 1024 / 1024 * 10) / 10;
          return isNaN(pid) ? null : { pid, mem };
        })
        .filter(Boolean);
    } else {
      const out = execFileSync('ps', ['aux'], { encoding: 'utf8', timeout: 5000 });
      return out.split('\n')
        .filter(l => l.includes('node') && l.includes('openclaw'))
        .map(l => {
          const parts = l.trim().split(/\s+/);
          const pid = parseInt(parts[1]);
          const mem = parseFloat(parts[3]);
          return isNaN(pid) ? null : { pid, mem: `${mem}%` };
        })
        .filter(Boolean);
    }
  } catch {
    return [];
  }
}

// 直接运行时打印状态
if (require.main === module) {
  console.log('');
  const procs = findOCProcesses();
  if (procs.length > 0) {
    console.log(`${C.green}  ● OpenClaw 运行中${C.reset}`);
    for (const p of procs) {
      console.log(`${C.gray}    PID: ${p.pid}  内存: ${p.mem}${env.IS_WIN ? ' MB' : ''}${C.reset}`);
    }
    console.log(`${C.cyan}    Dashboard: http://127.0.0.1:18789/${C.reset}`);
  } else {
    console.log(`${C.gray}  ○ OpenClaw 未运行${C.reset}`);
  }
  console.log('');
}

module.exports = { findOCProcesses };
