import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const token = process.env.PIXEL_HARNESS_TOKEN || randomBytes(32).toString('base64url');
const environment = { ...process.env, PIXEL_HARNESS_TOKEN: token };

const service = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'watch', 'service/src/index.ts'], {
  cwd: root, env: environment, stdio: 'inherit'
});
const ui = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
  cwd: root, env: environment, stdio: 'inherit'
});

let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  service.kill('SIGTERM');
  ui.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}

service.on('exit', (code) => stop(code ?? 1));
ui.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
