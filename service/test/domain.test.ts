import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, renameSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixelDatabase } from '../src/database.js';
import { canonicalDirectory, createDirectory } from '../src/folders.js';
import { classifyCodexFailure } from '../src/codex.js';
import { redactCodexText } from '../src/redaction.js';

function fixture() { const root = mkdtempSync(join(tmpdir(), 'pixel-harness-')); const db = new PixelDatabase(join(root, 'state.sqlite')); db.measureHost('local', {cpu:8,total:32*2**30,available:24*2**30,measured_at:Date.now(),source:'deterministic fixture'}); return { root, db }; }

test('migrations are durable and project lifecycle never touches attached files', () => {
  const { root, db } = fixture(), repo = join(root, 'repo'), repoTwo = join(root, 'repo-two'); mkdirSync(repo); mkdirSync(repoTwo); writeFileSync(join(repo, 'kept.txt'), 'source survives'); const project = db.createProject('Atlas'); const folder = db.attachFolder(project.project_id, realpathSync(repo), repo), folderTwo = db.attachFolder(project.project_id, realpathSync(repoTwo), repoTwo); const employee = db.createEmployee({ name: 'Mina' }); const task = db.createTask({ project_id: project.project_id, title: 'Ship it', employee_id: employee.employee_id, folder_ids: [folder.folder_id, folderTwo.folder_id], primary_folder_id: folder.folder_id });
  assert.equal(task.folders.find((item: { folder_id: string }) => item.folder_id === folder.folder_id).is_primary, 1); db.markProjectDone(project.project_id);db.setProjectStatus(project.project_id, 'archived'); assert.equal(db.getProject(project.project_id)?.status, 'archived'); assert.equal(readFileSync(join(repo, 'kept.txt'), 'utf8'), 'source survives'); db.close();
  const reopened = new PixelDatabase(join(root, 'state.sqlite')); assert.equal(reopened.projectDetail(project.project_id).tasks.length, 1); reopened.setProjectStatus(project.project_id, 'active'); assert.equal(reopened.getProject(project.project_id)?.status, 'active'); assert.equal(reopened.updateEmployee(employee.employee_id, { position_id: 'project-manager' }).title, 'Project Manager'); reopened.close();
});

test('folder aliases dedupe, overlap is rejected, and moved folders relink without changing identity', () => {
  const { root, db } = fixture(), repo = join(root, 'repo'), child = join(repo, 'child'), moved = join(root, 'moved'); mkdirSync(child, { recursive: true }); const project = db.createProject('Atlas'); const attached = db.attachFolder(project.project_id, realpathSync(repo), repo);
  assert.equal(db.attachFolder(project.project_id, realpathSync(repo), `${repo}/.`).folder_id, attached.folder_id);
  assert.throws(() => db.attachFolder(project.project_id, realpathSync(child), child), { code: 'OVERLAPPING_FOLDER' }); renameSync(repo, moved); db.setFolderAvailability(attached.folder_id, 'unavailable', 'Path no longer exists'); const relinked = db.relinkFolder(attached.folder_id, realpathSync(moved), moved); assert.equal(relinked.folder_id, attached.folder_id); assert.equal(relinked.availability, 'available'); db.close();
});

test('invalid folder paths cannot be selected or created through folder mediation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pixel-harness-')); await assert.rejects(() => canonicalDirectory(join(root, 'missing')), { code: 'PATH_UNAVAILABLE' }); await assert.rejects(() => createDirectory(root, '../escape'), { code: 'INVALID_FOLDER_NAME' }); assert.equal(await createDirectory(root, 'inside'), realpathSync(join(root, 'inside')));
});

test('tasks cannot cross project folder boundaries', () => {
  const { root, db } = fixture(), one = join(root, 'one'), two = join(root, 'two'); mkdirSync(one); mkdirSync(two); const first = db.createProject('One'), second = db.createProject('Two'); const secondFolder = db.attachFolder(second.project_id, realpathSync(two), two); assert.throws(() => db.createTask({ project_id: first.project_id, title: 'Wrong root', folder_ids: [secondFolder.folder_id], primary_folder_id: secondFolder.folder_id }), { code: 'INVALID_FOLDER_SELECTION' }); db.close();
});

test('a completed task can be reopened with its previous assignment restored', () => {
  const { root, db } = fixture(), repo = join(root, 'repo'); mkdirSync(repo);
  const project = db.createProject('Recovery'), folder = db.attachFolder(project.project_id, realpathSync(repo), repo), employee = db.createEmployee({ name: 'Hunter' });
  const task = db.createTask({ project_id: project.project_id, title: 'Retry launch', employee_id: employee.employee_id, folder_ids: [folder.folder_id], primary_folder_id: folder.folder_id });
  db.completeTask(task.task_id);
  assert.equal(db.taskDetail(task.task_id)?.assignments.length, 0);
  const reopened = db.reopenTask(task.task_id);
  assert.equal(reopened.status, 'planned');
  assert.equal(reopened.assignments[0].employee_id, employee.employee_id);
  db.close();
});

test('service restart reconciliation releases an orphaned execution lease', () => {
  const { root, db } = fixture(), one = join(root, 'one'), two = join(root, 'two'); mkdirSync(one); mkdirSync(two);
  const project = db.createProject('Runner'), first = db.attachFolder(project.project_id, realpathSync(one), one), second = db.attachFolder(project.project_id, realpathSync(two), two), employee = db.createEmployee({ name: 'Rae' });
  const task = db.createTask({ project_id: project.project_id, title: 'Inspect only', employee_id: employee.employee_id, folder_ids: [first.folder_id, second.folder_id], primary_folder_id: first.folder_id });
  const execution = db.startExecution({ task_id: task.task_id, employee_id: employee.employee_id, purpose: task.title, workspace_set: [one, two] });
  assert.ok(db.activeAttempt());
  assert.equal(db.reconcileActiveExecutions(), 1);
  assert.equal(db.activeAttempt(), undefined);
  assert.equal(db.executionDetail(String(execution.attempt_id)).continuation_state, 'lost');
  db.close();
});

test('duplicate dispatch is rejected while one worker lease owns execution', () => {
  const { root, db } = fixture(), one = join(root, 'one'), two = join(root, 'two'); mkdirSync(one); mkdirSync(two);
  const project = db.createProject('Exclusive'), first = db.attachFolder(project.project_id, realpathSync(one), one), second = db.attachFolder(project.project_id, realpathSync(two), two), employee = db.createEmployee({ name: 'Rae' });
  const task = db.createTask({ project_id: project.project_id, title: 'Only once', employee_id: employee.employee_id, folder_ids: [first.folder_id, second.folder_id], primary_folder_id: first.folder_id });
  db.startExecution({ task_id: task.task_id, employee_id: employee.employee_id, purpose: task.title, workspace_set: [one, two] });
  assert.throws(() => db.startExecution({ task_id: task.task_id, employee_id: employee.employee_id, purpose: task.title, workspace_set: [one, two] }), { code: 'WORKER_LEASE_CONFLICT' });
  db.close();
});

test('Codex failures are classified and credentials are redacted', () => {
  assert.equal(classifyCodexFailure(Object.assign(new Error('missing'), { code: 'ENOENT' })).code, 'MISSING_CLI');
  assert.equal(classifyCodexFailure(new Error('login required: unauthorized')).code, 'AUTHENTICATION_FAILED');
  assert.equal(classifyCodexFailure(new Error('usage limit exceeded')).code, 'USAGE_EXHAUSTED');
  assert.equal(classifyCodexFailure(new Error('configured model is unavailable')).code, 'MODEL_UNAVAILABLE');
  assert.equal(classifyCodexFailure(new Error('readonly database')).code, 'PERMISSION_DENIED');
  const redacted = redactCodexText('Authorization: Bearer secret-token-with-many-characters. key sk-abcdefghijklmnopqrstuvwxyz123456');
  assert.equal(redacted.includes('secret-token-with-many-characters'), false);
  assert.equal(redacted.includes('abcdefghijklmnopqrstuvwxyz123456'), false);
  assert.equal(redactCodexText('--ask-for-approval on-request'), '--ask-for-approval on-request');
  assert.match(redacted, /Bearer \[redacted\]/);
  assert.match(redacted, /sk-\[redacted\]/);
});

test('execution persistence redacts prompts, events, and queued messages', () => {
  const { root, db } = fixture(), one = join(root, 'one'), two = join(root, 'two'); mkdirSync(one); mkdirSync(two);
  const project = db.createProject('Redaction'), first = db.attachFolder(project.project_id, realpathSync(one), one), second = db.attachFolder(project.project_id, realpathSync(two), two), employee = db.createEmployee({ name: 'Rae' });
  const task = db.createTask({ project_id: project.project_id, title: 'Safe storage', employee_id: employee.employee_id, folder_ids: [first.folder_id, second.folder_id], primary_folder_id: first.folder_id });
  const secret = 'sk-abcdefghijklmnopqrstuvwxyz123456';
  const execution = db.startExecution({ task_id: task.task_id, employee_id: employee.employee_id, purpose: `Use ${secret}`, workspace_set: [one, two] });
  db.appendEvent(String(execution.attempt_id), 'attempt.output_delta', { text: `Bearer secret-token-with-many-characters ${secret}` });
  db.queueMessage(String(execution.session_id), `Follow up with ${secret}`);
  const persisted = JSON.stringify(db.executionDetail(String(execution.attempt_id)));
  assert.equal(persisted.includes(secret), false);
  assert.equal(persisted.includes('secret-token-with-many-characters'), false);
  assert.match(persisted, /redacted/);
  db.close();
});

test('plan approval is versioned and scoped guidance selects only its project and task', () => {
  const { root, db } = fixture(), one = join(root, 'one'), two = join(root, 'two'), other = join(root, 'other'); mkdirSync(one); mkdirSync(two); mkdirSync(other);
  const project = db.createProject('Atlas'), unrelated = db.createProject('Elsewhere'); const first = db.attachFolder(project.project_id, realpathSync(one), one), second = db.attachFolder(project.project_id, realpathSync(two), two), otherFolder = db.attachFolder(unrelated.project_id, realpathSync(other), other); const employee = db.createEmployee({ name: 'Rae' });
  const task = db.createTask({ project_id: project.project_id, title: 'Bounded work', employee_id: employee.employee_id, folder_ids: [first.folder_id, second.folder_id], primary_folder_id: first.folder_id });
  const firstPlan = db.createPlan({ project_id: project.project_id, task_id: task.task_id, summary: 'First proposal', milestones: ['Inspect'], acceptance: ['Proof'] }); db.approvePlan(firstPlan.plan_id, 'Hunter');
  const revision = db.createPlan({ project_id: project.project_id, task_id: task.task_id, summary: 'Material revision' }); assert.equal(db.planDetail(firstPlan.plan_id)?.status, 'superseded'); assert.equal(db.approvedPlanForTask(task.task_id), undefined); db.approvePlan(revision.plan_id, 'Hunter'); assert.equal(db.approvedPlanForTask(task.task_id)?.plan_id, revision.plan_id);
  const projectGuide = db.addGuidance({ project_id: project.project_id, content: 'Use the established API shape.', provenance: 'user direction' }); db.addGuidance({ project_id: project.project_id, task_id: task.task_id, content: 'Keep this task bounded.', provenance: 'review' }); db.addGuidance({ project_id: unrelated.project_id, content: 'Do not leak.', provenance: 'other project' }); assert.equal(db.guidanceForTask(project.project_id, task.task_id).length, 2); db.retireGuidance(String(projectGuide.guidance_id)); assert.equal(db.guidanceForTask(project.project_id, task.task_id).length, 1); db.close();
});

test('a Codex agent marker creates one durable inbox request for its own task', () => {
  const { root, db } = fixture(), one = join(root, 'one'), two = join(root, 'two'); mkdirSync(one); mkdirSync(two);
  const project = db.createProject('Agent requests'), first = db.attachFolder(project.project_id, realpathSync(one), one), second = db.attachFolder(project.project_id, realpathSync(two), two), employee = db.createEmployee({ name: 'Rae' });
  const task = db.createTask({ project_id: project.project_id, title: 'Needs a choice', employee_id: employee.employee_id, folder_ids: [first.folder_id, second.folder_id], primary_folder_id: first.folder_id }); const attempt = db.startExecution({ task_id: task.task_id, employee_id: employee.employee_id, purpose: task.title, workspace_set: [one, two] });
  const text = 'I cannot choose safely.\n[PIXEL_REQUEST] clarification | Choose the target color | Work is blocked pending the user choice';
  const request = db.createAgentRequest(String(attempt.attempt_id), text, 'item_1'); assert.equal(request?.source, 'codex'); assert.equal(request?.summary, 'Choose the target color'); assert.equal(db.createAgentRequest(String(attempt.attempt_id), text, 'item_1'), undefined); assert.equal(db.listInbox('pending').length, 1); db.close();
});

test('office preference, predefined identity, multi-task ownership, and simulated inbox persist', () => {
  const { root, db } = fixture(), repo = join(root, 'repo'); mkdirSync(repo);
  const project = db.createProject('Office'), folder = db.attachFolder(project.project_id, realpathSync(repo), repo), employee = db.createEmployee({ name: 'Rae' });
  assert.equal(db.preferences().map_treatment, 'warm');
  db.updatePreferences({ map_treatment: 'editorial', reduced_motion: true });
  assert.equal(db.preferences().map_treatment, 'editorial');
  assert.throws(() => db.updateAppearance(employee.employee_id, {}), { code: 'PREDEFINED_CHARACTER_REQUIRED' });
  assert.equal(employee.character_id, 'studio-character-01');
  const first = db.createTask({ project_id: project.project_id, title: 'First', employee_id: employee.employee_id, folder_ids: [folder.folder_id], primary_folder_id: folder.folder_id });
  const second = db.createTask({ project_id: project.project_id, title: 'Second', employee_id: employee.employee_id, folder_ids: [folder.folder_id], primary_folder_id: folder.folder_id });
  assert.equal(db.employeeDetail(employee.employee_id)?.active_assignments.length, 2);
  db.completeTask(first.task_id);
  assert.equal(db.employeeDetail(employee.employee_id)?.assignment?.task_id, second.task_id);
  const notice = db.createSimulatedRequest({ project_id: project.project_id, employee_id: employee.employee_id, task_id: second.task_id });
  assert.equal(notice?.source, 'simulated'); assert.match(String(notice?.detail), /longer technical/); db.resolveRequest(notice!.request_id); assert.equal(db.listInbox('resolved').length, 1);
  db.close(); const reopened = new PixelDatabase(join(root, 'state.sqlite')); assert.equal(reopened.preferences().map_treatment, 'editorial'); assert.equal(reopened.employeeDetail(employee.employee_id)?.history.length, 2); reopened.close();
});
