#!/usr/bin/env node
// Disposable integration probe for Pixel Harness packet 00.
// It uses only two caller-provided empty folders and writes JSONL evidence.
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const evidenceDirectory = resolve(process.argv[2] ?? ".");
const workspaceA = resolve(process.argv[3] ?? "/private/tmp/pixel-harness-probe-a");
const workspaceB = resolve(process.argv[4] ?? "/private/tmp/pixel-harness-probe-b");
const transcriptPath = resolve(evidenceDirectory, "app-server-probe.jsonl");
const summaryPath = resolve(evidenceDirectory, "app-server-probe-summary.json");
await mkdir(evidenceDirectory, { recursive: true });
await rm(workspaceA, { recursive: true, force: true });
await rm(workspaceB, { recursive: true, force: true });
await mkdir(workspaceA, { recursive: true });
await mkdir(workspaceB, { recursive: true });

const startedAt = new Date().toISOString();
const server = spawn("codex", ["app-server", "--stdio"], {
  stdio: ["pipe", "pipe", "pipe"],
});
let sequence = 0;
let stdoutBuffer = "";
let stderr = "";
const pending = new Map();
const notifications = [];

function redact(value) {
  const text = JSON.stringify(value);
  return JSON.parse(text.replaceAll(process.env.HOME ?? "/Users/hunter", "$HOME"));
}
async function record(kind, value) {
  await writeFile(
    transcriptPath,
    `${JSON.stringify({ sequence: ++sequence, at: new Date().toISOString(), kind, value: redact(value) })}\n`,
    { flag: "a" },
  );
}
function send(method, params) {
  const id = `packet-00-${++sequence}`;
  const request = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolveRequest, rejectRequest) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectRequest(new Error(`Timed out waiting for ${method}`));
    }, 90_000);
    pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer, method });
    void record("request", request);
    server.stdin.write(`${JSON.stringify(request)}\n`);
  });
}
function waitFor(predicate, timeoutMs, label) {
  return new Promise((resolveWait, rejectWait) => {
    const timer = setTimeout(() => rejectWait(new Error(`Timed out waiting for ${label}`)), timeoutMs);
    const poll = () => {
      const match = notifications.find(predicate);
      if (match) {
        clearTimeout(timer);
        resolveWait(match);
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}
function processLine(line) {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch { void record("stdout-non-json", line); return; }
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id);
    clearTimeout(entry.timer);
    pending.delete(message.id);
    void record("response", message);
    if (message.error) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`));
    else entry.resolve(message.result);
  } else {
    notifications.push(message);
    void record("notification", message);
  }
}
server.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk.toString();
  const lines = stdoutBuffer.split("\n");
  stdoutBuffer = lines.pop() ?? "";
  for (const line of lines) processLine(line);
});
server.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

let threadId;
let firstTurnId;
let result = { startedAt, workspaceA: basename(workspaceA), workspaceB: basename(workspaceB) };
try {
  await send("initialize", {
    clientInfo: { name: "pixel-harness-packet-00", title: "Pixel Harness Packet 00", version: "0.1.0" },
    capabilities: { experimentalApi: true, requestAttestation: false },
  });

  const terminalProcessId = "packet-00-pty";
  const terminalResult = send("command/exec", {
    command: ["sh", "-lc", "printf 'READY\\n'; read value; printf 'INPUT:%s\\n' \"$value\"; stty size; sleep 30"],
    cwd: workspaceA,
    processId: terminalProcessId,
    tty: true,
    streamStdin: true,
    streamStdoutStderr: true,
    size: { rows: 24, cols: 80 },
  });
  const ptyReady = await waitFor(
    (message) => message.method === "command/exec/outputDelta" && message.params?.processId === terminalProcessId && Buffer.from(message.params?.deltaBase64 ?? "", "base64").toString().includes("READY"),
    10_000,
    "PTY ready output",
  );
  await send("command/exec/resize", { processId: terminalProcessId, size: { rows: 40, cols: 100 } });
  await send("command/exec/write", { processId: terminalProcessId, deltaBase64: Buffer.from("packet-00-input\n").toString("base64") });
  const ptyInput = await waitFor(
    (message) => message.method === "command/exec/outputDelta" && message.params?.processId === terminalProcessId && Buffer.from(message.params?.deltaBase64 ?? "", "base64").toString().includes("INPUT:packet-00-input"),
    10_000,
    "PTY input echo",
  );
  await send("command/exec/terminate", { processId: terminalProcessId });
  result.pty = { response: await terminalResult, ready: ptyReady.params, input: ptyInput.params };

  const thread = await send("thread/start", {
    cwd: workspaceA,
    runtimeWorkspaceRoots: [workspaceA, workspaceB],
    sandbox: "workspace-write",
    approvalPolicy: "never",
    historyMode: "paginated",
  });
  threadId = thread.thread.id;
  const firstTurn = await send("turn/start", {
    threadId,
    input: [{ type: "text", text: `This is a disposable integration probe. Create a file named packet-00-a.txt containing exactly A in ${workspaceA}, and a file named packet-00-b.txt containing exactly B in ${workspaceB}. Do not inspect any other paths. Then report both paths.` }],
  });
  firstTurnId = firstTurn.turn.id;
  const firstCompletion = await waitFor(
    (message) => message.method === "turn/completed" && message.params?.threadId === threadId && message.params?.turn?.id === firstTurnId,
    80_000,
    "first Codex turn completion",
  );
  const secondTurn = await send("turn/start", {
    threadId,
    input: [{ type: "text", text: "Follow-up for the same execution: reply only with the words FOLLOW-UP RECEIVED." }],
  });
  const secondCompletion = await waitFor(
    (message) => message.method === "turn/completed" && message.params?.threadId === threadId && message.params?.turn?.id === secondTurn.turn.id,
    80_000,
    "second Codex turn completion",
  );
  result.thread = { threadId, firstTurnId, secondTurnId: secondTurn.turn.id, firstCompletion: firstCompletion.params, secondCompletion: secondCompletion.params };
  result.files = {
    a: await readFile(resolve(workspaceA, "packet-00-a.txt"), "utf8"),
    b: await readFile(resolve(workspaceB, "packet-00-b.txt"), "utf8"),
  };
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
} finally {
  server.kill("SIGTERM");
  result.finishedAt = new Date().toISOString();
  result.stderr = stderr.replaceAll(process.env.HOME ?? "/Users/hunter", "$HOME");
  await writeFile(summaryPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}
