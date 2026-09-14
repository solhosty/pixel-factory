import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PixelDatabase } from './database.js';
import { browseDirectory, canonicalDirectory, createDirectory, chooseNativeDirectory } from './folders.js';
import { ServiceError } from './types.js';
import { CodexExecution, classifyCodexFailure, codexReadiness } from './codex.js';

const host = '127.0.0.1', port = Number(process.env.PIXEL_HARNESS_SERVICE_PORT || 4318);
const uiOrigin = process.env.PIXEL_HARNESS_UI_ORIGIN || 'http://127.0.0.1:5173';
const token = process.env.PIXEL_HARNESS_TOKEN || randomBytes(32).toString('base64url');
const dataDir = resolve(process.env.PIXEL_HARNESS_DATA_DIR || '.pixel-harness');
const db = new PixelDatabase(resolve(dataDir, 'pixel-harness.sqlite'));
db.reconcileActiveExecutions();
let execution: CodexExecution | undefined;
const clientGraceMs = Number(process.env.PIXEL_HARNESS_CLIENT_GRACE_MS || 10_000);
let closing = false;
let resumeRetryAt = 0;

function requestId() { return `req_${randomUUID()}`; }
function json(res: ServerResponse, status: number, value: unknown, origin?: string) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) }); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage) { let raw = ''; for await (const chunk of req) raw += chunk; try { return raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { throw new ServiceError('INVALID_JSON', 'Request body must be JSON'); } }
function authorize(req: IncomingMessage) {
  const origin = req.headers.origin;
  const requestHost = String(req.headers.host || '').split(':')[0];
  if (requestHost !== '127.0.0.1' && requestHost !== 'localhost') throw new ServiceError('FORBIDDEN_HOST', 'Only loopback requests are allowed', {}, 403);
  if (origin !== uiOrigin) throw new ServiceError('FORBIDDEN_ORIGIN', 'Request origin is not the launched local UI', {}, 403);
  if (req.headers['x-pixel-harness-token'] !== token) throw new ServiceError('UNAUTHORIZED', 'Missing or invalid local service token', {}, 401);
  return origin;
}
async function refreshAvailability(projectId: string) { for (const folder of db.listFolders(projectId)) { if (!existsSync(folder.canonical_path)) db.setFolderAvailability(folder.folder_id, 'unavailable', 'Path no longer exists'); else { try { await canonicalDirectory(folder.canonical_path); db.setFolderAvailability(folder.folder_id, 'available'); } catch { db.setFolderAvailability(folder.folder_id, 'unavailable', 'Path cannot be resolved'); } } } }
async function launchExecution(payload: Record<string, unknown>) {
  const taskId = String(payload.task_id || ''), employeeId = String(payload.employee_id || '');
  const task = db.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
  const approvedPlan = db.approvedPlanForTask(taskId);
  if (!approvedPlan || String(payload.plan_id || '') !== approvedPlan.plan_id) throw new ServiceError('PLAN_APPROVAL_REQUIRED', 'Approve the current plan version before dispatching this task.', { task_id: taskId, approved_plan_id: approvedPlan?.plan_id || null }, 409);
  const prompt = String(payload.prompt || '').trim() || `A Pixel Harness terminal session is ready for the task "${String(task.title)}". Do not inspect or modify files yet. Reply briefly that you are ready for the user's instructions.`;
  const folders = task.folders as Array<{ canonical_path: string; availability: string }>;
  if (folders.length < 2) throw new ServiceError('MULTI_FOLDER_REQUIRED', 'This Codex execution needs two selected task folders before launch.', { folder_count: folders.length }, 409);
  const unavailable = folders.filter((folder) => folder.availability !== 'available' || !existsSync(folder.canonical_path));
  if (unavailable.length) throw new ServiceError('FOLDER_UNAVAILABLE', 'Relink all selected folders before launching.', { folders: unavailable.map((folder) => folder.canonical_path) }, 409);
  const readiness = await codexReadiness(); if (readiness.state !== 'ready') throw new ServiceError(readiness.state.toUpperCase(), readiness.detail, {}, 409);
  const guidance = db.guidanceForTask(String(task.project_id), taskId) as Array<{ content: string; provenance: string }>;
  const guidanceContext = guidance.length ? `\n\nApplicable project guidance (with provenance):\n${guidance.map((item) => `- ${item.content} [${item.provenance}]`).join('\n')}` : '';
  const resolvedContext=db.resolvedContext(employeeId,String(task.project_id),taskId,prompt) as any;
  const skillContext=resolvedContext.skills.length?`\n\nEmployee skill snapshot (instructions only; grants no permissions or access):\n${resolvedContext.skills.map((skill:any)=>`- ${skill.name}: ${skill.instructions}`).join('\n')}`:'';
  const executionPrompt=prompt+skillContext+guidanceContext;
  // Revalidate after readiness's asynchronous probe; reserve synchronously before spawning.
  if (db.approvedPlanForTask(taskId)?.plan_id !== approvedPlan.plan_id) throw new ServiceError('PLAN_APPROVAL_REQUIRED', 'The plan changed during readiness; approve the current version.', {}, 409);
  db.measureHost();
  const started = db.startExecution({ task_id: taskId, employee_id: employeeId, purpose: executionPrompt, workspace_set: folders.map((folder) => folder.canonical_path), resolved_context:resolvedContext });
  execution = new CodexExecution(db, String(started.attempt_id), dataDir);
  try { await execution.start(folders.map((folder) => folder.canonical_path), executionPrompt); }
  catch (error) { const failure = classifyCodexFailure(error); db.appendEvent(String(started.attempt_id), 'attempt.adapter_error', { code: failure.code, message: failure.message }); db.releaseExecution(String(started.attempt_id), failure.stopReason, 'lost'); execution = undefined; throw new ServiceError(failure.code, `${failure.message} The saved attempt was reconciled.`, {}, failure.status); }
  return db.executionDetail(String(started.attempt_id));
}
async function sendFollowUp(payload: Record<string, unknown>) {
  const attemptId = String(payload.attempt_id || ''), content = String(payload.content || '').trim();
  if (!content) throw new ServiceError('VALIDATION_ERROR', 'A follow-up message is required');
  if (!execution || execution.attemptId !== attemptId) throw new ServiceError('TERMINAL_DETACHED', 'The active Codex session is not attached to this service.', {}, 409);
  const detail = db.executionDetail(attemptId); const messageId = db.queueMessage(String(detail.session_id), content);
  db.markMessage(messageId, 'delivering', attemptId);
  try { await execution.sendFollowUp(content); db.markMessage(messageId, 'delivered', attemptId); db.appendEvent(attemptId, 'attempt.follow_up_delivered', { message_id: messageId }); }
  catch (error) { db.markMessage(messageId, 'failed', attemptId); throw error; }
  return db.executionDetail(attemptId);
}
async function stopOwned(reason: string, preserveContinuation: boolean) {
  if (!execution) return null;
  const attemptId = execution.attemptId;
  if (preserveContinuation) db.createContinuation(attemptId, reason);
  else db.cancelContinuationsFor({ task_id: String(db.executionDetail(attemptId).task_id) });
  await execution.stop(reason); execution = undefined;
  return db.executionDetail(attemptId);
}
async function resumeEligible() {
  if (execution || Date.now() < resumeRetryAt) return null;
  const candidate = db.continuations('eligible')[0]; if (!candidate) return null;
  db.measureHost();
  const started = db.resumeContinuation(String(candidate.continuation_id));
  execution = new CodexExecution(db, String(started.attempt_id), dataDir);
  try { await execution.start(started.workspace_set as string[], String(started.purpose), String(started.resume_thread_id || '')); db.markContinuationResumed(String(candidate.continuation_id), String(started.attempt_id)); resumeRetryAt = 0; }
  catch (error) { const failure = classifyCodexFailure(error); db.appendEvent(String(started.attempt_id), 'attempt.recovery_failed', { code: failure.code }); db.releaseExecution(String(started.attempt_id), failure.stopReason, 'lost'); execution = undefined; resumeRetryAt = Date.now() + 2_000; throw error; }
  return db.executionDetail(String(started.attempt_id));
}

const server = createServer(async (req, res) => {
  const id = requestId();
  try {
    if (req.method === 'OPTIONS') { const requestHost = String(req.headers.host || '').split(':')[0]; if ((requestHost !== '127.0.0.1' && requestHost !== 'localhost') || req.headers.origin !== uiOrigin) throw new ServiceError('FORBIDDEN_ORIGIN', 'Request origin is not the launched local UI', {}, 403); res.writeHead(204, { 'Access-Control-Allow-Origin': uiOrigin, 'Access-Control-Allow-Headers': 'Content-Type, X-Pixel-Harness-Token', 'Access-Control-Allow-Methods': 'GET, POST, PATCH', Vary: 'Origin' }); return res.end(); }
    const origin = authorize(req); const url = new URL(req.url || '/', `http://${host}:${port}`); const payload = ['POST', 'PATCH'].includes(req.method || '') ? await body(req) : {};
    let output: unknown;
    if (req.method === 'GET' && url.pathname === '/api/v1/projects') { for (const project of db.listProjects()) await refreshAvailability(project.project_id); output = db.listProjects().map((project) => db.projectDetail(project.project_id)); }
    else if (req.method === 'GET' && url.pathname === '/api/v1/codex/readiness') output = await codexReadiness();
    else if (req.method === 'GET' && url.pathname === '/api/v1/executions/active') { const active = db.activeAttempt(); output = active ? { ...db.executionDetail(String(active.attempt_id)), terminal: execution?.attemptId === active.attempt_id ? execution.snapshot() : { terminal: '', attached: false } } : null; }
    else if (req.method === 'GET' && /^\/api\/v1\/executions\/[^/]+$/.test(url.pathname)) output = db.executionDetail(url.pathname.split('/')[4]);
    else if (req.method === 'GET' && url.pathname === '/api/v1/board') output = db.taskBoard();
    else if (req.method === 'GET' && url.pathname === '/api/v1/environments') { db.measureHost(); output = db.environments(); }
    else if (req.method === 'GET' && url.pathname === '/api/v1/office/runtime') output = { ...db.officeState(), clients: db.clientCount(), grace_ms: clientGraceMs, continuations: db.continuations() };
    else if (req.method === 'POST' && url.pathname === '/api/v1/office/heartbeat') { const count = db.heartbeatClient(String(payload.client_id || '')); if (!execution) await resumeEligible().catch(() => null); output = { ...db.officeState(), clients: count, grace_ms: clientGraceMs }; }
    else if (req.method === 'POST' && url.pathname === '/api/v1/office/disconnect') output = { clients: db.disconnectClient(String(payload.client_id || '')), grace_ms: clientGraceMs };
    else if (req.method === 'POST' && url.pathname === '/api/v1/office/close') { db.setOfficeState('closing'); await stopOwned('office_close', true); db.setOfficeState('closed'); output = db.officeState(); }
    else if (req.method === 'POST' && url.pathname === '/api/v1/office/resume') { db.setOfficeState('open'); output = await resumeEligible(); }
    else if (req.method === 'POST' && url.pathname === '/api/v1/office/stop') { await stopOwned('manual_office_stop', false); for (const item of db.continuations()) db.cancelContinuationsFor({ project_id: String(item.project_id) }); output = db.officeState(); }
    else if (req.method === 'POST' && url.pathname === '/api/v1/environments') output = db.createRemoteEnvironment(String(payload.name || ''));
    else if (req.method === 'PATCH' && /^\/api\/v1\/hosts\/[^/]+\/capacity$/.test(url.pathname)) output = db.setCapacityCeiling(url.pathname.split('/')[4], payload.ceiling);
    else if (req.method === 'PATCH' && /^\/api\/v1\/staff\/[^/]+\/environment$/.test(url.pathname)) output = db.bindEnvironment(url.pathname.split('/')[4], String(payload.environment_id || ''));
    else if (req.method === 'POST' && url.pathname === '/api/v1/executions') output = await launchExecution(payload);
    else if (req.method === 'POST' && /^\/api\/v1\/executions\/[^/]+\/messages$/.test(url.pathname)) { output = await sendFollowUp({ ...payload, attempt_id: url.pathname.split('/')[4] }); }
    else if (req.method === 'POST' && /^\/api\/v1\/executions\/[^/]+\/stop$/.test(url.pathname)) { const attemptId = url.pathname.split('/')[4]; if (!execution || execution.attemptId !== attemptId) throw new ServiceError('TERMINAL_DETACHED', 'The owned execution is not attached to this service.', {}, 409); output = await stopOwned('manual_session_stop', false); }
    else if (req.method === 'POST' && /^\/api\/v1\/staff\/[^/]+\/stop$/.test(url.pathname)) { const employeeId = url.pathname.split('/')[4]; if (execution && String(db.executionDetail(execution.attemptId).employee_id) === employeeId) await stopOwned('manual_employee_stop', false); db.cancelContinuationsFor({ employee_id: employeeId }); output = db.employeeDetail(employeeId); }
    else if (req.method === 'POST' && /^\/api\/v1\/projects\/[^/]+\/pause$/.test(url.pathname)) { const projectId = url.pathname.split('/')[4]; if (execution && String(db.executionDetail(execution.attemptId).project_id) === projectId) await stopOwned('manual_project_pause', false); output = db.pauseProject(projectId, true); }
    else if (req.method === 'POST' && /^\/api\/v1\/projects\/[^/]+\/resume$/.test(url.pathname)) { output = db.pauseProject(url.pathname.split('/')[4], false); }
    else if (req.method === 'POST' && /^\/api\/v1\/executions\/[^/]+\/terminal-input$/.test(url.pathname)) { const attemptId = url.pathname.split('/')[4]; if (!execution || execution.attemptId !== attemptId) throw new ServiceError('TERMINAL_DETACHED', 'The owned terminal is not attached.', {}, 409); await execution.terminalInput(String(payload.data || '')); output = { accepted: true }; }
    else if (req.method === 'POST' && /^\/api\/v1\/executions\/[^/]+\/resize$/.test(url.pathname)) { const attemptId = url.pathname.split('/')[4]; if (!execution || execution.attemptId !== attemptId) throw new ServiceError('TERMINAL_DETACHED', 'The owned terminal is not attached.', {}, 409); await execution.resize(Number(payload.rows), Number(payload.cols)); output = { accepted: true }; }
    else if (req.method === 'POST' && url.pathname === '/api/v1/projects') output = db.createProject(String(payload.name || ''));
    else if (req.method === 'POST' && /^\/api\/v1\/projects\/[^/]+\/archive$/.test(url.pathname)) output = db.setProjectStatus(url.pathname.split('/')[4], 'archived');
    else if (req.method === 'POST' && /^\/api\/v1\/projects\/[^/]+\/reopen$/.test(url.pathname)) output = db.setProjectStatus(url.pathname.split('/')[4], 'active');
    else if (req.method === 'PATCH' && /^\/api\/v1\/projects\/[^/]+\/delivery$/.test(url.pathname)) output = db.updateDelivery(url.pathname.split('/')[4], payload as { default_branch?: string | null; delivery_mode?: string; notes?: string });
    else if (req.method === 'POST' && /^\/api\/v1\/projects\/[^/]+\/folders$/.test(url.pathname)) { const path = await canonicalDirectory(payload.path); output = db.attachFolder(url.pathname.split('/')[4], path, String(payload.path)); }
    else if (req.method === 'POST' && /^\/api\/v1\/folders\/[^/]+\/relink$/.test(url.pathname)) { const path = await canonicalDirectory(payload.path); output = db.relinkFolder(url.pathname.split('/')[4], path, String(payload.path)); }
    else if (req.method === 'GET' && url.pathname === '/api/v1/folders/browse') output = await browseDirectory(url.searchParams.get('path'));
    else if (req.method === 'POST' && url.pathname === '/api/v1/folders/native-select') output = { path: await chooseNativeDirectory() };
    else if (req.method === 'POST' && url.pathname === '/api/v1/folders/create') output = { path: await createDirectory(payload.parent_path, payload.name) };
    else if (req.method === 'GET' && url.pathname === '/api/v1/staff/catalog') output = db.staffCatalog();
    else if (req.method === 'GET' && url.pathname === '/api/v1/staff') output = db.listEmployees();
    else if (req.method === 'POST' && url.pathname === '/api/v1/staff') output = db.createEmployee(payload as { name: string; position_id?: string; character_id?: string });
    else if (req.method === 'PATCH' && /^\/api\/v1\/staff\/[^/]+$/.test(url.pathname)) output = db.updateEmployee(url.pathname.split('/')[4], payload as { name?: string; position_id?: string; character_id?: string; active?: boolean });
    else if (req.method === 'POST' && /^\/api\/v1\/staff\/[^/]+\/skills$/.test(url.pathname)) output = db.addEmployeeSkill(url.pathname.split('/')[4],payload as any);
    else if (req.method === 'PATCH' && /^\/api\/v1\/staff\/[^/]+\/skills\/[^/]+$/.test(url.pathname)) { const parts=url.pathname.split('/'); output=db.setEmployeeSkill(parts[4],parts[6],Boolean(payload.enabled)); }
    else if (req.method === 'PATCH' && /^\/api\/v1\/staff\/[^/]+\/appearance$/.test(url.pathname)) output = db.updateAppearance(url.pathname.split('/')[4], payload as Record<string, string>);
    else if (req.method === 'POST' && url.pathname === '/api/v1/tasks') output = db.createTask(payload as { project_id: string; title: string; employee_id?: string; folder_ids: string[]; primary_folder_id: string });
    else if (req.method === 'POST' && /^\/api\/v1\/tasks\/[^/]+\/complete$/.test(url.pathname)) output = db.completeTask(url.pathname.split('/')[4]);
    else if (req.method === 'POST' && /^\/api\/v1\/tasks\/[^/]+\/reopen$/.test(url.pathname)) output = db.reopenTask(url.pathname.split('/')[4]);
    else if (req.method === 'PATCH' && /^\/api\/v1\/tasks\/[^/]+\/folders$/.test(url.pathname)) output = db.updateTaskFolders(url.pathname.split('/')[4], payload as { folder_ids: string[]; primary_folder_id: string });
    else if (req.method === 'GET' && url.pathname === '/api/v1/office/preferences') output = db.preferences();
    else if (req.method === 'PATCH' && url.pathname === '/api/v1/office/preferences') output = db.updatePreferences(payload as { map_treatment?: 'warm' | 'cool' | 'editorial'; reduced_motion?: boolean });
    else if (req.method === 'GET' && url.pathname === '/api/v1/inbox') output = db.listInbox(url.searchParams.get('status') === 'resolved' ? 'resolved' : url.searchParams.get('status') === 'pending' ? 'pending' : undefined);
    else if (req.method === 'GET' && url.pathname === '/api/v1/decisions') output = db.listDecisions(url.searchParams.get('project_id') || undefined);
    else if (req.method === 'POST' && url.pathname === '/api/v1/decisions') output = db.createDecision(payload as any);
    else if (req.method === 'POST' && /^\/api\/v1\/decisions\/[^/]+\/revise$/.test(url.pathname)) output = db.reviseDecision(url.pathname.split('/')[4], payload as any);
    else if (req.method === 'POST' && /^\/api\/v1\/decisions\/[^/]+\/approve$/.test(url.pathname)) output = db.approveDecision(url.pathname.split('/')[4], payload as any);
    else if (req.method === 'POST' && url.pathname === '/api/v1/plans') output = db.createPlan(payload as { project_id: string; task_id: string; summary: string; milestones?: unknown; acceptance?: unknown; dependencies?: unknown });
    else if (req.method === 'POST' && /^\/api\/v1\/plans\/[^/]+\/approve$/.test(url.pathname)) output = db.approvePlan(url.pathname.split('/')[4], String(payload.approved_by || 'local user'));
    else if (req.method === 'POST' && url.pathname === '/api/v1/guidance') output = db.addGuidance(payload as { project_id: string; task_id?: string; content: string; provenance: string; replaces_guidance_id?: string });
    else if (req.method === 'POST' && /^\/api\/v1\/guidance\/[^/]+\/retire$/.test(url.pathname)) output = db.retireGuidance(url.pathname.split('/')[4]);
    else if (req.method === 'POST' && url.pathname === '/api/v1/inbox/requests') {
      const attempt = db.activeAttempt(); if (!attempt || !execution) throw new ServiceError('NO_ACTIVE_SESSION', 'A real Codex request needs an active owned session.', {}, 409);
      const active = db.executionDetail(String(attempt.attempt_id)); const task = db.taskDetail(String(active.task_id))!;
      const content = String(payload.detail || '').trim(); if (!content) throw new ServiceError('VALIDATION_ERROR', 'Describe the clarification or revision request');
      const messageId = db.queueMessage(String(active.session_id), content); db.markMessage(messageId, 'delivering', String(active.attempt_id));
      try { await execution.sendFollowUp(content); db.markMessage(messageId, 'delivered', String(active.attempt_id)); } catch (error) { db.markMessage(messageId, 'failed', String(active.attempt_id)); throw error; }
      output = db.createRealRequest({ project_id: String(task.project_id), employee_id: String(active.employee_id), task_id: String(active.task_id), kind: String(payload.kind || 'clarification'), summary: String(payload.summary || 'Codex needs a decision'), detail: content, blocks: String(payload.blocks || 'The active Codex session is waiting for this direction.'), message_id: messageId });
    }
    else if (req.method === 'POST' && /^\/api\/v1\/inbox\/[^/]+\/answer$/.test(url.pathname)) {
      const request = db.listInbox().find((item: any) => item.request_id === url.pathname.split('/')[4]) as any;
      const response = String(payload.response || '').trim(); if (!request || !response) throw new ServiceError('NOT_FOUND', 'A pending inbox request and response are required.', {}, 404);
      if (execution && db.activeAttempt() && String(db.activeAttempt()!.task_id) === String(request.task_id)) await sendFollowUp({ attempt_id: String(db.activeAttempt()!.attempt_id), content: `Decision response to your ${request.kind} request: ${response}` });
      output = db.answerRequest(request.request_id, response);
    }
    else if (req.method === 'POST' && /^\/api\/v1\/inbox\/[^/]+\/resolve$/.test(url.pathname)) output = db.resolveRequest(url.pathname.split('/')[4]);
    else throw new ServiceError('NOT_FOUND', 'API route not found', { method: req.method, path: url.pathname }, 404);
    json(res, 200, { data: output, request_id: id }, origin);
  } catch (error) { const value = error instanceof ServiceError ? error : new ServiceError('INTERNAL_ERROR', 'The local service could not complete this request', {}, 500); json(res, value.status, { error: { code: value.code, message: value.message, details: value.details, request_id: id } }); }
});
server.listen(port, host, () => { console.log(`Pixel Harness local service: http://${host}:${port}`); console.log(`Open the UI with this one-launch token (it is not stored): ${uiOrigin}/#token=${token}`); console.log(`Data: ${dataDir}`); });
const clientSweep = setInterval(() => {
  const count = db.expireClients(new Date(Date.now() - clientGraceMs).toISOString());
  if (!count && execution && db.officeState().state === 'open') { db.setOfficeState('closing'); void stopOwned('last_client_disconnect', true).finally(() => db.setOfficeState('closed')); }
}, Math.max(500, Math.min(2000, clientGraceMs / 2)));
function closeService() {
  if (closing) return; closing = true; clearInterval(clientSweep); db.setOfficeState('closing');
  void stopOwned('graceful_service_stop', true).catch(() => {}).finally(() => { db.setOfficeState('closed'); server.close(() => db.close()); });
}
process.on('SIGINT', closeService);
process.on('SIGTERM', closeService);
