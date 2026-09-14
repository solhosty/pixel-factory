#!/usr/bin/env node
// Tests one app-server endpoint shared by a protocol client and a native Codex TUI.
import net from "node:net";
import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const evidenceDirectory = resolve(process.argv[2] ?? ".");
const socketPath = resolve(process.argv[3] ?? "pixel-harness-e01.sock");
const workspace = resolve(process.argv[4] ?? "/private/tmp/pixel-harness-remote-native-resume");
const transcriptPath = resolve(evidenceDirectory, "remote-native-resume-probe.jsonl");
const summaryPath = resolve(evidenceDirectory, "remote-native-resume-probe-summary.json");
await mkdir(evidenceDirectory, { recursive: true });
await rm(transcriptPath, { force: true });
await rm(summaryPath, { force: true });
await rm(workspace, { recursive: true, force: true });
await mkdir(workspace, { recursive: true });

const client = net.createConnection(socketPath);
let sequence = 0;
let buffer = Buffer.alloc(0);
const pending = new Map();
const notifications = [];
let terminalOutput = "";
const result = { startedAt: new Date().toISOString(), socketPath: "$WORKSPACE/pixel-harness-e01.sock", workspace: "$TMP/pixel-harness-remote-native-resume" };
const redact = (value) => JSON.parse(JSON.stringify(value, (key, nestedValue) => key === "developer_instructions" ? "[omitted from evidence]" : nestedValue).replaceAll(process.env.HOME ?? "/Users/hunter", "$HOME"));
async function record(kind, value) { await writeFile(transcriptPath, `${JSON.stringify({ sequence: ++sequence, at: new Date().toISOString(), kind, value: redact(value) })}\n`, { flag: "a" }); }
function call(method, params) {
  const id = `remote-native-${++sequence}`;
  const request = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => { pending.delete(id); rejectCall(new Error(`Timed out: ${method}`)); }, 90_000);
    pending.set(id, { resolve: resolveCall, reject: rejectCall, timer, method });
    void record("request", request); sendWebSocketText(JSON.stringify(request));
  });
}
function waitFor(predicate, timeoutMs, name) {
  return new Promise((resolveWait, rejectWait) => {
    const timer = setTimeout(() => rejectWait(new Error(`Timed out: ${name}`)), timeoutMs);
    const poll = () => { const found = notifications.find(predicate); if (found) { clearTimeout(timer); resolveWait(found); } else setTimeout(poll, 50); };
    poll();
  });
}
function receive(text) {
  if (!text.trim()) return;
  let message; try { message = JSON.parse(text); } catch { void record("non-json", text); return; }
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id); clearTimeout(entry.timer); pending.delete(message.id); void record("response", message);
    if (message.error) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`)); else entry.resolve(message.result);
  } else {
    notifications.push(message);
    if (message.method === "process/outputDelta" && message.params?.processHandle === "remote-native-tui") terminalOutput += Buffer.from(message.params.deltaBase64, "base64").toString("utf8");
    void record("notification", message);
  }
}
let upgraded = false;
let resolveUpgrade;
let rejectUpgrade;
function sendWebSocketText(text) {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
  else if (payload.length <= 0xffff) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0xfe; header.writeUInt16BE(payload.length, 2); }
  else throw new Error("Probe request unexpectedly exceeds WebSocket short-frame limit");
  const masked = Buffer.from(payload);
  for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
  client.write(Buffer.concat([header, mask, masked]));
}
function decodeFrames() {
  while (buffer.length >= 2) {
    const opcode = buffer[0] & 0x0f;
    let length = buffer[1] & 0x7f;
    let offset = 2;
    if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
    if (buffer.length < offset + length) return;
    const payload = buffer.subarray(offset, offset + length);
    buffer = buffer.subarray(offset + length);
    if (opcode === 0x1) receive(payload.toString());
    if (opcode === 0x8) { void record("websocket-close", payload.toString()); }
  }
}
client.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  if (!upgraded) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const headers = buffer.subarray(0, headerEnd).toString();
    buffer = buffer.subarray(headerEnd + 4);
    if (!headers.startsWith("HTTP/1.1 101")) { rejectUpgrade(new Error(`WebSocket upgrade failed: ${headers.split("\r\n")[0]}`)); return; }
    upgraded = true; resolveUpgrade();
  }
  decodeFrames();
});
await new Promise((resolveConnect, rejectConnect) => {
  client.once("connect", () => {
    const key = crypto.randomBytes(16).toString("base64");
    client.write(`GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    resolveUpgrade = resolveConnect; rejectUpgrade = rejectConnect;
  });
  client.once("error", rejectConnect);
});

let handle = "remote-native-tui";
try {
  await call("initialize", { clientInfo: { name: "pixel-harness-remote-native", title: "Pixel Harness shared endpoint probe", version: "0.1.0" }, capabilities: { experimentalApi: true, requestAttestation: false } });
  const thread = await call("thread/start", { cwd: workspace, runtimeWorkspaceRoots: [workspace], sandbox: "workspace-write", approvalPolicy: "never", historyMode: "paginated" });
  const threadId = thread.thread.id;
  const turn = await call("turn/start", { threadId, input: [{ type: "text", text: "For this disposable integration probe, run `sleep 12` with the shell. Do not do anything else until it finishes." }] });
  const turnId = turn.turn.id;
  const initialUserMessage = await waitFor((message) => message.method === "item/started" && message.params?.threadId === threadId && message.params?.turnId === turnId && message.params?.item?.type === "userMessage", 30_000, "initial user message");
  const commandStarted = await waitFor((message) => message.method === "item/started" && message.params?.threadId === threadId && message.params?.turnId === turnId && message.params?.item?.type === "commandExecution", 45_000, "Codex command start");
  await call("process/spawn", { command: ["codex", "--remote", `unix://${socketPath}`, "resume", threadId, "--no-alt-screen"], cwd: workspace, processHandle: handle, tty: true, streamStdin: true, streamStdoutStderr: true, size: { rows: 36, cols: 120 }, env: { TERM: "xterm-256color" }, timeoutMs: 20_000 });
  await waitFor((message) => message.method === "process/outputDelta" && message.params?.processHandle === handle, 15_000, "remote native TUI output");
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  await call("process/resizePty", { processHandle: handle, size: { rows: 45, cols: 140 } });
  // The native TUI advertises Tab as the active-turn follow-up queue control.
  await call("process/writeStdin", { processHandle: handle, deltaBase64: Buffer.from("For this probe, run sleep 30, then reply exactly REMOTE FOLLOW-UP.\t").toString("base64") });
  await waitFor(() => terminalOutput.includes("Queued follow-up inputs"), 10_000, "native TUI queue acknowledgement");
  const followUp = await waitFor((message) => message.method === "item/started" && message.params?.threadId === threadId && message.params?.item?.type === "userMessage" && message.params.item.id !== initialUserMessage.params.item.id, 35_000, "native TUI follow-up delivery");
  const followUpCommand = await waitFor((message) => message.method === "item/started" && message.params?.threadId === threadId && message.params?.turnId === followUp.params.turnId && message.params?.item?.type === "commandExecution", 35_000, "native follow-up command start");
  await call("turn/interrupt", { threadId, turnId: followUp.params.turnId });
  const interrupted = await waitFor((message) => message.method === "turn/completed" && message.params?.threadId === threadId && message.params?.turn?.id === followUp.params.turnId, 20_000, "interrupted Codex turn completion");
  const resumed = await call("thread/resume", { threadId });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  const output = Buffer.concat(notifications.filter((message) => message.method === "process/outputDelta" && message.params?.processHandle === handle).map((message) => Buffer.from(message.params.deltaBase64, "base64"))).toString("utf8");
  const exited = notifications.find((message) => message.method === "process/exited" && message.params?.processHandle === handle);
  result.thread = { threadId, turnId, commandItemId: commandStarted.params.item.id, commandProcessId: commandStarted.params.item.processId, followUpItemId: followUp.params.item.id, followUpTurnId: followUp.params.turnId, followUpCommandItemId: followUpCommand.params.item.id, interruptStatus: interrupted.params.turn.status, resumedThreadId: resumed.thread.id };
  result.nativeResumePty = { processHandle: handle, outputContainsResuming: output.includes("Resuming session"), outputContainsActiveWriter: output.includes("active writer"), resized: true, followUpTyped: true, exited: exited?.params ?? null };
  if (!exited) await call("process/kill", { processHandle: handle });
} catch (error) { result.error = error instanceof Error ? error.message : String(error); }
finally { result.finishedAt = new Date().toISOString(); client.end(); await writeFile(summaryPath, `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); }
