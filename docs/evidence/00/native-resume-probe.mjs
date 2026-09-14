#!/usr/bin/env node
// Disposable packet-00 probe: can a real `codex resume <thread-id>` TUI
// rejoin an active app-server thread when hosted in a service-owned PTY?
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const evidenceDirectory = resolve(process.argv[2] ?? ".");
const workspace = resolve(process.argv[3] ?? "/private/tmp/pixel-harness-native-resume");
const transcriptPath = resolve(evidenceDirectory, "native-resume-probe.jsonl");
const summaryPath = resolve(evidenceDirectory, "native-resume-probe-summary.json");
await mkdir(evidenceDirectory, { recursive: true });
await rm(workspace, { recursive: true, force: true });
await mkdir(workspace, { recursive: true });

const server = spawn("codex", ["app-server", "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
let sequence = 0;
let buffer = "";
let stderr = "";
const pending = new Map();
const notifications = [];
const result = { startedAt: new Date().toISOString(), workspace: "$TMP/pixel-harness-native-resume" };
const redact = (value) => JSON.parse(JSON.stringify(value).replaceAll(process.env.HOME ?? "/Users/hunter", "$HOME"));
async function record(kind, value) {
  await writeFile(transcriptPath, `${JSON.stringify({ sequence: ++sequence, at: new Date().toISOString(), kind, value: redact(value) })}\n`, { flag: "a" });
}
function call(method, params) {
  const id = `native-resume-${++sequence}`;
  const request = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => { pending.delete(id); rejectCall(new Error(`Timed out: ${method}`)); }, 90_000);
    pending.set(id, { resolve: resolveCall, reject: rejectCall, timer, method });
    void record("request", request);
    server.stdin.write(`${JSON.stringify(request)}\n`);
  });
}
function waitFor(predicate, timeoutMs, name) {
  return new Promise((resolveWait, rejectWait) => {
    const timer = setTimeout(() => rejectWait(new Error(`Timed out: ${name}`)), timeoutMs);
    const poll = () => {
      const found = notifications.find(predicate);
      if (found) { clearTimeout(timer); resolveWait(found); return; }
      setTimeout(poll, 50);
    };
    poll();
  });
}
function receive(line) {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch { void record("stdout-non-json", line); return; }
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id);
    clearTimeout(entry.timer); pending.delete(message.id); void record("response", message);
    if (message.error) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`));
    else entry.resolve(message.result);
  } else { notifications.push(message); void record("notification", message); }
}
server.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
  for (const line of lines) receive(line);
});
server.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

let terminalHandle;
try {
  await call("initialize", { clientInfo: { name: "pixel-harness-native-resume", title: "Pixel Harness native resume probe", version: "0.1.0" }, capabilities: { experimentalApi: true, requestAttestation: false } });
  const thread = await call("thread/start", { cwd: workspace, runtimeWorkspaceRoots: [workspace], sandbox: "workspace-write", approvalPolicy: "never", historyMode: "paginated" });
  const threadId = thread.thread.id;
  const turn = await call("turn/start", { threadId, input: [{ type: "text", text: "For this disposable integration probe, run `sleep 30` with the shell. Do not do anything else until it finishes." }] });
  const turnId = turn.turn.id;
  const commandStarted = await waitFor(
    (message) => message.method === "item/started" && message.params?.threadId === threadId && message.params?.turnId === turnId && message.params?.item?.type === "commandExecution",
    45_000,
    "Codex command execution start",
  );
  terminalHandle = "native-resume-tui";
  await call("process/spawn", { command: ["codex", "resume", threadId, "--no-alt-screen"], cwd: workspace, processHandle: terminalHandle, tty: true, streamStdin: true, streamStdoutStderr: true, size: { rows: 36, cols: 120 }, env: { TERM: "xterm-256color" }, timeoutMs: 20_000 });
  const terminalOutput = await waitFor(
    (message) => message.method === "process/outputDelta" && message.params?.processHandle === terminalHandle,
    15_000,
    "native Codex resume terminal output",
  );
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
  const terminalBytes = Buffer.concat(notifications
    .filter((message) => message.method === "process/outputDelta" && message.params?.processHandle === terminalHandle)
    .map((message) => Buffer.from(message.params.deltaBase64, "base64"))).toString("base64");
  await call("process/resizePty", { processHandle: terminalHandle, size: { rows: 45, cols: 140 } });
  await call("process/kill", { processHandle: terminalHandle });
  result.thread = { threadId, turnId, commandItemId: commandStarted.params.item.id, commandProcessId: commandStarted.params.item.processId };
  result.nativeResumePty = { processHandle: terminalHandle, firstOutputBase64: terminalOutput.params.deltaBase64, allOutputBase64: terminalBytes, resized: true, killed: true };
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
} finally {
  result.finishedAt = new Date().toISOString();
  result.stderr = stderr.replaceAll(process.env.HOME ?? "/Users/hunter", "$HOME");
  server.kill("SIGTERM");
  await writeFile(summaryPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}
