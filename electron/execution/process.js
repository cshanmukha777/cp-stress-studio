const { spawn } = require('node:child_process');
const fs = require('node:fs');

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => child.kill('SIGKILL'));
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
  }
}

// RSS samples are telemetry, not a memory limit; null means unavailable.
function supervise(command, args, { cwd, stdin = '', timeout = 2000, signal, onOutput, env = process.env } = {}) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    let stdout = '', stderr = '', status = null, memory = null, bytes = 0;
    let memoryProbe = null;
    const child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stop = (verdict) => { status ||= verdict; killTree(child); };
    const abort = () => stop('CANCELLED');
    const timer = setTimeout(() => stop('TLE'), timeout);
    const sampler = setInterval(() => {
      if (process.platform === 'linux' && child.pid) {
        try {
          const rss = /VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${child.pid}/status`, 'utf8'));
          if (rss) memory = Math.max(memory || 0, Number(rss[1]));
        } catch { /* process ended between samples */ }
      }
      if (process.platform === 'darwin' && child.pid && !memoryProbe) {
        memoryProbe = spawn('ps', ['-o', 'rss=', '-p', String(child.pid)], {stdio:['ignore','pipe','ignore']});
        let output = '';
        memoryProbe.stdout.on('data', chunk => { output += chunk; });
        memoryProbe.on('error', () => {});
        memoryProbe.on('close', () => { const rss = Number(output.trim()); if (rss > 0) memory = Math.max(memory || 0, rss); memoryProbe = null; });
      }
    }, process.platform === 'linux' ? 10 : 50);
    const capture = (stream, chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 1024 * 1024) { stop('RE'); return; }
      const text = chunk.toString();
      if (stream === 'stdout') stdout += text; else stderr += text;
      onOutput?.({ stream, text });
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => capture('stdout', chunk));
    child.stderr.on('data', (chunk) => capture('stderr', chunk));
    child.stdin.on('error', () => {}); // A program may exit without consuming stdin.
    child.on('error', (error) => { status ||= 'RE'; stderr += `${command}: ${error.message}`; });
    child.on('close', (code) => {
      clearTimeout(timer); clearInterval(sampler); memoryProbe?.kill('SIGKILL'); signal?.removeEventListener('abort', abort);
      killTree(child); // Also reap descendants left behind by an exited parent.
      if (bytes > 1024 * 1024) stderr += '\nOutput limit exceeded (1 MiB)';
      resolve({ status: status || (code === 0 ? 'AC' : 'RE'), stdout, stderr, time: Number(process.hrtime.bigint() - start) / 1e6, memory });
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdin.end(stdin);
  });
}
module.exports = { supervise };
