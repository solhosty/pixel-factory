import { spawn, execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PixelDatabase } from './database.js';
import { ServiceError } from './types.js';
import { redactCodexText } from './redaction.js';

type Rpc = { id?: string; method?: string; params?: any; result?: any; error?: any };
const redact = redactCodexText;
export function classifyCodexFailure(error: unknown) {
  const value = error as { code?: string; message?: string; stderr?: string; stdout?: string };
  const detail = redact(String(value?.stderr || value?.message || value?.stdout || error || 'Codex execution failed.'));
  if (value?.code === 'ENOENT' || /command not found|not found on path/i.test(detail)) return { code: 'MISSING_CLI', message: 'Codex CLI was not found on PATH.', status: 409, stopReason: 'capability_missing' };
  if (/not logged in|login required|unauthorized|authentication|invalid.*credential/i.test(detail)) return { code: 'AUTHENTICATION_FAILED', message: 'Codex authentication is required or no longer valid.', status: 401, stopReason: 'authentication_failed' };
  if (/usage limit|quota|rate limit|too many requests|insufficient credits/i.test(detail)) return { code: 'USAGE_EXHAUSTED', message: 'Codex usage is currently exhausted.', status: 429, stopReason: 'usage_exhausted' };
  if (/model.*(?:not found|unavailable|unsupported|does not exist)|unsupported.*model/i.test(detail)) return { code: 'MODEL_UNAVAILABLE', message: 'The configured Codex model is unavailable.', status: 409, stopReason: 'capability_missing' };
  if (/permission denied|operation not permitted|read-only|readonly|access denied/i.test(detail)) return { code: 'PERMISSION_DENIED', message: 'Codex does not have permission to use the selected workspace or local state.', status: 403, stopReason: 'permission_wait' };
  return { code: 'ADAPTER_ERROR', message: 'Codex could not start the selected execution.', status: 502, stopReason: 'adapter_error' };
}
const command = (args: string[]) => new Promise<{ stdout: string; stderr: string }>((resolve, reject) => execFile('codex', args, { timeout: 12_000 }, (error, stdout, stderr) => error ? reject(Object.assign(error, { stdout, stderr })) : resolve({ stdout, stderr })));

class UnixRpc {
  private socket!: net.Socket; private buffer = Buffer.alloc(0); private upgraded = false;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private serial = 0;
  constructor(private readonly path: string, private readonly onNotification: (message: Rpc) => void) {}
  async connect() {
    await new Promise<void>((resolve, reject) => {
      const socket = this.socket = net.createConnection(this.path); let upgradeResolve = resolve;
      socket.once('error', reject);
      socket.on('data', (chunk) => { this.buffer = Buffer.concat([this.buffer, chunk]); if (!this.upgraded) { const end = this.buffer.indexOf('\r\n\r\n'); if (end < 0) return; const header = this.buffer.subarray(0, end).toString(); this.buffer = this.buffer.subarray(end + 4); if (!header.startsWith('HTTP/1.1 101')) return reject(new Error(`Codex app-server WebSocket upgrade failed: ${header.split('\r\n')[0]}`)); this.upgraded = true; upgradeResolve(); } this.decode(); });
      socket.once('connect', () => { const key = randomBytes(16).toString('base64'); socket.write(`GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`); });
    });
  }
  private decode() { while (this.buffer.length >= 2) { const opcode = this.buffer[0] & 0x0f; let length = this.buffer[1] & 0x7f; let offset = 2; if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; } if (this.buffer.length < offset + length) return; const payload = this.buffer.subarray(offset, offset + length); this.buffer = this.buffer.subarray(offset + length); if (opcode === 1) this.receive(payload.toString()); } }
  private receive(text: string) { let message: Rpc; try { message = JSON.parse(text); } catch { return; } if (message.id && this.pending.has(message.id)) { const pending = this.pending.get(message.id)!; clearTimeout(pending.timer); this.pending.delete(message.id); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); } else this.onNotification(message); }
  call(method: string, params: Record<string, unknown>) { const id = `pixel-${++this.serial}`; const encoded = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, method, params })); const mask = randomBytes(4); let header: Buffer; if (encoded.length < 126) header = Buffer.from([0x81, 0x80 | encoded.length]); else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0xfe; header.writeUInt16BE(encoded.length, 2); } for (let i = 0; i < encoded.length; i++) encoded[i] ^= mask[i % 4]; this.socket.write(Buffer.concat([header, mask, encoded])); return new Promise<any>((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 60_000); this.pending.set(id, { resolve, reject, timer }); }); }
  close() { this.socket?.end(); }
}

export type Readiness = { state: 'ready' | 'missing_cli' | 'authentication_failed' | 'capability_missing'; detail: string; cli_version?: string };
export async function codexReadiness(): Promise<Readiness> {
  try { const version = (await command(['--version'])).stdout.trim(); try { await command(['login', 'status']); return { state: 'ready', detail: 'Codex CLI is installed and authenticated for local use.', cli_version: version }; } catch (error: any) { return { state: 'authentication_failed', detail: classifyCodexFailure(error).message, cli_version: version }; } }
  catch (error: any) { return { state: 'missing_cli', detail: redact(String(error.code === 'ENOENT' ? 'Codex CLI was not found on PATH.' : error.stderr || 'Codex CLI could not start.')) }; }
}

export class CodexExecution {
  private appServer?: ReturnType<typeof spawn>; private rpc?: UnixRpc; private terminal = ''; private processHandle = 'native-tui'; private stopped = false; private runtimeDir?: string;
  constructor(private readonly db: PixelDatabase, readonly attemptId: string, private readonly dataDir: string) {}
  snapshot() { return { terminal: this.terminal, attached: Boolean(this.rpc) && !this.stopped }; }
  private event(message: Rpc) {
    if (message.method === 'process/outputDelta' && message.params?.processHandle === this.processHandle) { const text = redact(Buffer.from(message.params.deltaBase64, 'base64').toString('utf8')); this.terminal = (this.terminal + text).slice(-100_000); this.db.appendEvent(this.attemptId, 'attempt.terminal_delta', { text }); return; }
    if (message.method === 'turn/completed') { this.db.appendEvent(this.attemptId, 'attempt.turn_completed', { status: message.params?.turn?.status || 'unknown' }, message.params?.turn?.id || null); return; }
    if (message.method === 'item/started') { const item = message.params?.item; if (item?.type === 'commandExecution') this.db.setProviderIdentity(this.attemptId, { itemId: item.id || null, processId: item.processId || null, turnId: message.params?.turnId || null }); this.db.appendEvent(this.attemptId, 'attempt.item_started', { type: item?.type || 'unknown' }, item?.id || null); }
    if (message.method === 'item/completed') { const item = message.params?.item; const text = typeof item?.text === 'string' ? item.text : typeof item?.content === 'string' ? item.content : ''; this.db.appendEvent(this.attemptId, 'attempt.item_completed', { type: item?.type || 'unknown' }, item?.id || null); if (text) { const request = this.db.createAgentRequest(this.attemptId, text, item?.id); if (request) this.db.appendEvent(this.attemptId, 'attempt.agent_request', { request_id: request.request_id, kind: request.kind }, item?.id || null); } }
    if (message.method === 'process/exited' && message.params?.processHandle === this.processHandle) { this.db.appendEvent(this.attemptId, 'attempt.terminal_detached', { exit_code: message.params?.exitCode ?? null }); this.stopped = true; }
  }
  private async waitForSocket(path: string) { for (let attempt = 0; attempt < 80; attempt++) { if (existsSync(path)) { try { await new Promise<void>((resolve, reject) => { const socket = net.createConnection(path); socket.once('connect', () => { socket.end(); resolve(); }); socket.once('error', reject); }); return; } catch {} } await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error('Codex app-server did not create its private socket.'); }
  async start(workspaces: string[], prompt: string, resumeThreadId?: string | null) {
    this.runtimeDir = mkdtempSync(join(tmpdir(), 'ph-')); const socketPath = join(this.runtimeDir, 'c.sock');
    try {
      this.appServer = spawn('codex', ['app-server', '--listen', `unix://${socketPath}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      if (this.appServer.pid) this.db.activateCapacity(this.attemptId, this.appServer.pid, `codex-app-server:${this.appServer.pid}:${Date.now()}`);
      this.appServer.on('error', () => {});
      this.appServer.stderr.on('data', (chunk) => this.db.appendEvent(this.attemptId, 'attempt.adapter_stderr', { text: redact(String(chunk)).slice(-2000) }));
      await this.waitForSocket(socketPath); chmodSync(socketPath, 0o600);
      this.rpc = new UnixRpc(socketPath, (message) => this.event(message)); await this.rpc.connect();
      await this.rpc.call('initialize', { clientInfo: { name: 'pixel-harness', title: 'Pixel Harness', version: '0.1.0' }, capabilities: { experimentalApi: true, requestAttestation: false } });
      const thread = resumeThreadId
        ? await this.rpc.call('thread/resume', { threadId: resumeThreadId, cwd: workspaces[0], runtimeWorkspaceRoots: workspaces, sandbox: 'workspace-write', approvalPolicy: 'never', historyMode: 'paginated' })
        : await this.rpc.call('thread/start', { cwd: workspaces[0], runtimeWorkspaceRoots: workspaces, sandbox: 'workspace-write', approvalPolicy: 'never', historyMode: 'paginated' });
      const threadId = thread.thread.id;
      this.db.setProviderIdentity(this.attemptId, { threadId }); this.db.appendEvent(this.attemptId, resumeThreadId ? 'attempt.resumed' : 'attempt.started', { workspace_count: workspaces.length }, threadId);
      const turn = await this.rpc.call('turn/start', { threadId, input: [{ type: 'text', text: resumeThreadId ? `Continue after the Pixel Harness office was safely closed. ${prompt}` : prompt }] }); this.db.setProviderIdentity(this.attemptId, { threadId, turnId: turn.turn.id });
      await this.rpc.call('process/spawn', { command: ['codex', '--remote', `unix://${socketPath}`, 'resume', threadId, '--no-alt-screen'], cwd: workspaces[0], processHandle: this.processHandle, tty: true, streamStdin: true, streamStdoutStderr: true, size: { rows: 30, cols: 100 }, env: { TERM: 'xterm-256color' }, timeoutMs: 600_000 });
    } catch (error) { await this.disposeOwner(); throw error; }
  }
  async terminalInput(data: string) { if (!this.rpc || this.stopped) throw new ServiceError('TERMINAL_DETACHED', 'The native terminal is not attached.', {}, 409); await this.rpc.call('process/writeStdin', { processHandle: this.processHandle, deltaBase64: Buffer.from(data).toString('base64') }); }
  async sendFollowUp(content: string) {
    if (!this.rpc || this.stopped) throw new ServiceError('TERMINAL_DETACHED', 'The active Codex session is not attached.', {}, 409);
    const threadId = this.db.executionDetail(this.attemptId).provider_thread_id as string | null;
    if (!threadId) throw new ServiceError('PROVIDER_THREAD_MISSING', 'The active Codex session has no provider thread identity.', {}, 409);
    const turn = await this.rpc.call('turn/start', { threadId, input: [{ type: 'text', text: content }] });
    this.db.setProviderIdentity(this.attemptId, { turnId: turn.turn?.id || null });
  }
  async resize(rows: number, cols: number) { if (!this.rpc || this.stopped) return; await this.rpc.call('process/resizePty', { processHandle: this.processHandle, size: { rows: Math.max(5, Math.min(120, rows)), cols: Math.max(20, Math.min(240, cols)) } }); }
  private async disposeOwner() {
    this.rpc?.close();
    const child = this.appServer;
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve, reject) => {
        const force = setTimeout(() => child.kill('SIGKILL'), 2000);
        const failed = setTimeout(() => reject(new ServiceError('OWNER_STOP_UNCONFIRMED', 'The app-server has not exited; capacity remains occupied.', {}, 409)), 5000);
        child.once('exit', () => { clearTimeout(force); clearTimeout(failed); resolve(); });
        child.kill('SIGTERM');
      });
    }
    this.db.reconcileCapacity(this.attemptId);
    if (this.runtimeDir) rmSync(this.runtimeDir, { recursive: true, force: true });
  }
  async stop(reason = 'user_stop') {
    this.stopped = true;
    try { const threadId = this.db.executionDetail(this.attemptId).provider_thread_id as string | null; if (threadId) await this.rpc?.call('turn/interrupt', { threadId, turnId: null }); } catch {}
    try { await this.rpc?.call('process/kill', { processHandle: this.processHandle }); } catch {}
    await this.disposeOwner();
    this.db.appendEvent(this.attemptId, 'attempt.stopped', { reason });
    this.db.releaseExecution(this.attemptId, reason);
  }
}
