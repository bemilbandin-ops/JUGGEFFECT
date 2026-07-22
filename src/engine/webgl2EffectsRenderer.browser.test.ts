import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'juggeffect-webgl-'));
const port = await new Promise<number>((resolve) => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') throw new Error('Unable to reserve a test port');
    const selected = address.port;
    probe.close(() => resolve(selected));
  });
});
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env: { ...process.env, DISABLE_HMR: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/src/engine/webgl2EffectsRenderer.browser.test.html`);
      if (response.ok) return;
    } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for Vite');
}

try {
  await waitForServer();
  const browser = spawn(chrome, [
    '--headless=new',
    '--disable-background-networking',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=10000',
    '--dump-dom',
    `http://127.0.0.1:${port}/src/engine/webgl2EffectsRenderer.browser.test.html`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  browser.stdout.on('data', (chunk) => stdout.push(chunk));
  browser.stderr.on('data', (chunk) => stderr.push(chunk));
  const exitCode = await new Promise<number | null>((resolve) => browser.on('exit', resolve));
  const html = Buffer.concat(stdout).toString();
  const report = html.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]
    .replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
  if (exitCode !== 0 || !report) throw new Error(`Chrome failed (${exitCode}): ${Buffer.concat(stderr).toString()}`);
  console.log(report);
  if (!report.startsWith('PASS')) process.exitCode = 1;
} finally {
  vite.kill();
  rmSync(profile, { recursive: true, force: true });
}
