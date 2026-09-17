import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'docs/evidence/3H');
const portSeed = 4500 + (process.pid % 1000);
const servicePort = portSeed;
const uiPort = portSeed + 1000;
const debugPort = portSeed + 2000;
const token = 'demo-local-token';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const liveNative = process.argv.includes('--live-native');
mkdirSync(output, { recursive: true });

const service = spawn(process.execPath, ['--import', 'tsx', 'service/src/index.ts'], { cwd: root, env: { ...process.env, PIXEL_HARNESS_DATA_DIR: '.pixel-harness-demo', PIXEL_HARNESS_SERVICE_PORT: String(servicePort), PIXEL_HARNESS_UI_ORIGIN: `http://127.0.0.1:${uiPort}`, PIXEL_HARNESS_TOKEN: token }, stdio: 'ignore' });
const ui = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(uiPort), '--host', '127.0.0.1'], { cwd: root, env: { ...process.env, VITE_PIXEL_HARNESS_API: `http://127.0.0.1:${servicePort}/api/v1` }, stdio: 'ignore' });
let browser;
const stop = () => { service.kill(); ui.kill(); browser?.kill(); };
process.on('exit', stop);

async function waitFor(url, options) { let last; for (let i = 0; i < 60; i++) { try { const response = await fetch(url, options); if (response.ok) return response; last = new Error(`${url} returned ${response.status}`); } catch (error) { last = error; } await sleep(250); } throw last; }
async function api(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${servicePort}/api/v1${path}`, { method, headers: { Origin: `http://127.0.0.1:${uiPort}`, 'X-Pixel-Harness-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error?.message || `${method} ${path} failed with ${response.status}`);
  return value.data;
}
await waitFor(`http://127.0.0.1:${uiPort}/`);
await waitFor(`http://127.0.0.1:${servicePort}/api/v1/projects`, { headers: { Origin: `http://127.0.0.1:${uiPort}`, 'X-Pixel-Harness-Token': token } });

browser = spawn(chrome, ['--headless=new', '--no-first-run', '--disable-gpu', '--disable-background-networking', '--disable-component-update', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/private/tmp/pixel-3h-cdp-profile-${process.pid}`, '--window-size=1440,960', `http://127.0.0.1:${uiPort}/#token=${token}`], { stdio: 'ignore' });
const targets = await waitFor(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.includes(`:${uiPort}`));
if (!target) throw new Error('Chrome did not expose the demo page.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolvePromise, reject) => { socket.addEventListener('open', resolvePromise, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); });
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject })); }
async function evaluate(expression) { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
async function screenshot(name) { const result = await command('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(output, name), Buffer.from(result.data, 'base64')); }
async function click(selector) { const found = await evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.click(); return true; })()`); if (!found) throw new Error(`Missing rendered control: ${selector}`); await sleep(500); }
async function clickText(text) { const found = await evaluate(`(() => { const node = [...document.querySelectorAll('button')].find(item => item.textContent.includes(${JSON.stringify(text)})); if (!node) return false; node.click(); return true; })()`); if (!found) throw new Error(`Missing rendered button: ${text}`); await sleep(500); }

await command('Page.enable');
await command('Runtime.enable');
await sleep(1200);
await screenshot('rehearsal-desktop-studio.png');
await sleep(1800);
await screenshot('rehearsal-office-activity-walk.png');
await sleep(1800);
await screenshot('rehearsal-office-activity-loop.png');

await click('.studio-sidebar .row');
await screenshot('rehearsal-employee-tasks.png');

await click('[aria-label="Task board"]');
await screenshot('rehearsal-task-board.png');
await clickText('Clarify the release review');
await screenshot('rehearsal-task-workspace.png');
await clickText('Open session history');
await screenshot('rehearsal-saved-session.png');
await click('[aria-label="Inbox"]');
await screenshot('rehearsal-inbox.png');
await click('.request-list button');
await screenshot('rehearsal-inbox-request.png');
await screenshot('rehearsal-inbox-route.png');
await click('[aria-label="Room settings"]');
if (!await evaluate(`Boolean(document.querySelector('input[type="checkbox"]:checked'))`)) await click('input[type="checkbox"]');
if (!await evaluate(`document.querySelector('main')?.classList.contains('reduce-motion')`)) throw new Error('Reduced-motion preference was not applied.');
await screenshot('rehearsal-reduced-motion.png');
await click('[aria-label="Close room settings"]');
await evaluate(`(() => { document.activeElement?.blur(); return document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', bubbles: true, cancelable: true })); })()`);
await sleep(400);
if (!await evaluate(`Boolean(document.querySelector('.directory h1')?.textContent.includes('Office task board'))`)) throw new Error('Keyboard task-board shortcut did not route to the board.');

if (liveNative) {
  const task = await api('/tasks/task-demo-release-review/thread');
  const decision = task.thread.decisions.find(item => item.status === 'pending');
  const plan = task.plans.find(item => item.status === 'approved');
  const employeeId = task.assignments[0]?.employee_id;
  if (!decision || !plan || !employeeId) throw new Error('Live-native rehearsal fixture is missing its decision, approved plan, or owner.');
  await api(`/decisions/${decision.decision_id}/approve`, 'POST', { version: decision.current_version, approved_by: 'demo rehearsal' });
  const started = await api('/executions', 'POST', { task_id: task.task_id, employee_id: employeeId, plan_id: plan.plan_id, prompt: 'Reply exactly: Demo native-terminal readiness confirmed. Do not inspect or modify files.' });
  await sleep(5000);
  const active = await api('/executions/active');
  if (!active?.terminal?.attached || !active.provider_thread_id) throw new Error('The real native Codex terminal did not attach with a provider thread.');
  await sleep(1500);
  await click('.task-thread .workspace-actions button:first-child');
  await click('[aria-label="Studio"]');
  await sleep(1200);
  if (!await evaluate(`Boolean(document.querySelector('.native-terminal'))`)) throw new Error('The native terminal surface was not visible after selecting Session.');
  await sleep(1000);
  await screenshot('rehearsal-live-native-terminal.png');
  const stopped = await api(`/executions/${started.attempt_id}/stop`, 'POST');
  if (!stopped?.events?.some(item => item.kind === 'attempt.stopped')) throw new Error('The live-native rehearsal did not persist a clean stop record.');
}

socket.close();
console.log(JSON.stringify({ output, checks: ['desktop', 'office activity frames', 'employee task choices', 'task board', 'task workspace', 'saved session', 'Inbox', 'employee request', 'Inbox route', 'reduced motion', 'keyboard board shortcut', ...(liveNative ? ['live native terminal and clean stop'] : [])] }, null, 2));
