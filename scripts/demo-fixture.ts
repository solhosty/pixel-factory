import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { PixelDatabase } from '../service/src/database.js';

const args = new Set(process.argv.slice(2));
const supplied = process.env.PIXEL_HARNESS_DEMO_DATA_DIR || '.pixel-harness-demo';
const dataDir = resolve(supplied);
const root = resolve(process.cwd());

if (args.has('--reset')) {
  if (dataDir === root || dataDir === resolve('/') || !dataDir.startsWith(`${root}/`)) {
    throw new Error('Refusing to reset outside a dedicated path beneath this checkout. Set PIXEL_HARNESS_DEMO_DATA_DIR to a child directory.');
  }
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
}
mkdirSync(dataDir, { recursive: true });

const workspace = join(dataDir, 'workspaces');
const product = join(workspace, 'product');
const research = join(workspace, 'research');
mkdirSync(product, { recursive: true });
mkdirSync(research, { recursive: true });
writeFileSync(join(product, 'README.md'), '# Demo fixture workspace\n');
writeFileSync(join(research, 'NOTES.md'), '# Demo fixture research\n');

const db = new PixelDatabase(join(dataDir, 'pixel-harness.sqlite'));
// The board-only progress card must remain reproducible even when this host's
// live memory sample is temporarily below the product's safe launch threshold.
// This fixture measurement never represents a real worker or native terminal.
db.measureHost('local', { cpu: 8, total: 16 * 1024 ** 3, available: 16 * 1024 ** 3, measured_at: Date.now(), source: 'resettable demo fixture capacity sample' });
const existing = db.listProjects().find((project: any) => project.name === 'Northstar workspace');
if (existing) {
  console.log(JSON.stringify({ data_dir: dataDir, project_id: existing.project_id, reused: true }, null, 2));
  db.close();
  process.exit(0);
}

const project = db.createProject('Northstar workspace');
const productFolder = db.attachFolder(project.project_id, product, product);
const researchFolder = db.attachFolder(project.project_id, research, research);
const employee = db.createEmployee({ name: 'Mina Park', position_id: 'fullstack-engineer', character_id: 'studio-character-01' });
// The Studio presents four other curated identities at desks. The player
// character is the only one who moves when the viewer chooses to walk, so the
// room reads as a workplace rather than a background-animation loop.
// These coworkers have no task, session, terminal, or fabricated execution state.
const jordan = db.createEmployee({ name: 'Jordan Vale', position_id: 'project-manager', character_id: 'studio-character-03' });
const sora = db.createEmployee({ name: 'Sora Bell', position_id: 'security-engineer', character_id: 'studio-character-04' });
db.createEmployee({ name: 'Theo Nguyen', position_id: 'designer', character_id: 'studio-character-05' });

const active = db.createTask({
  project_id: project.project_id,
  title: 'Clarify the release review',
  employee_id: employee.employee_id,
  folder_ids: [productFolder.folder_id, researchFolder.folder_id],
  primary_folder_id: productFolder.folder_id,
  brief_text: 'Make the release review easy to scan without changing its approval boundary.',
  task_instructions: 'Keep the recommendation compact and preserve the explicit approval step.',
  inputs: [{ input_id: 'review-note', kind: 'paste', label: 'Review note', content_base64: Buffer.from('Use one clear recommendation and retain the decision record.').toString('base64'), provenance: 'demo fixture' }]
});
const queued = db.createTask({
  project_id: project.project_id,
  title: 'Prepare the decision recap',
  employee_id: employee.employee_id,
  folder_ids: [researchFolder.folder_id, productFolder.folder_id],
  primary_folder_id: researchFolder.folder_id,
  brief_text: 'Prepare a concise recap after the review decision is recorded.',
  task_instructions: 'This task must remain in the sequential queue until the current session releases.'
});
const inProgress = db.createTask({
  project_id: project.project_id,
  title: 'Draft the onboarding checklist',
  employee_id: jordan.employee_id,
  folder_ids: [productFolder.folder_id],
  primary_folder_id: productFolder.folder_id,
  brief_text: 'Turn the existing onboarding notes into a concise checklist.',
  task_instructions: 'Keep the checklist practical and flag any missing owner.'
});
const complete = db.createTask({
  project_id: project.project_id,
  title: 'Archive the launch notes',
  employee_id: sora.employee_id,
  folder_ids: [researchFolder.folder_id],
  primary_folder_id: researchFolder.folder_id,
  brief_text: 'File the completed launch notes in the research workspace.',
  task_instructions: 'Preserve the source links and summarize the final outcome.'
});
for (const task of [active, queued, inProgress, complete]) {
  const plan = db.createPlan({ project_id: project.project_id, task_id: task.task_id, summary: task.task_id === active.task_id ? 'Review the focused release state and request the one blocking decision.' : 'Summarize the approved review decision for the release notes.' });
  db.approvePlan(plan.plan_id, 'Demo fixture');
}
// This is deliberately a saved, detached session record. It does not claim a
// live Codex process or fabricate terminal output; the UI labels it accordingly.
const saved = db.startExecution({ task_id: active.task_id, employee_id: employee.employee_id, purpose: 'Saved demo rehearsal session; no live terminal is attached.', workspace_set: [product, research] });
db.appendEvent(saved.attempt_id, 'attempt.saved_rehearsal_record', { provenance: 'fixture', note: 'Reviewable saved session only; no live Codex output.' });
try { db.startExecution({ task_id: queued.task_id, employee_id: employee.employee_id, purpose: 'Queued demo rehearsal session.', workspace_set: [research, product] }); } catch (error: any) {
  if (error?.code !== 'WAITING_FOR_CAPACITY') throw error;
}
db.releaseExecution(saved.attempt_id, 'demo_fixture_saved_history');
db.reconcileCapacity(saved.attempt_id);
// This gives the board an in-progress lane without claiming a terminal exists.
// The saved event makes that fixture limitation inspectable if the task is opened.
const boardProgress = db.startExecution({ task_id: inProgress.task_id, employee_id: jordan.employee_id, purpose: 'Fixture board progress state; no live terminal is attached.', workspace_set: [product] });
db.appendEvent(boardProgress.attempt_id, 'attempt.fixture_board_state', { provenance: 'fixture', note: 'Board-only progress state; no live Codex output or terminal is attached.' });
db.completeTask(complete.task_id);
db.addTaskThreadMessage(active.task_id, { body: 'Keep the review focused: one recommendation, one explicit approval.', save_as_team_agreement: true });
const decision = db.createDecision({
  project_id: project.project_id, employee_id: employee.employee_id, kind: 'ui', title: 'Release review density',
  recommendation: 'Use the focused review with one visible approval state.',
  options: [{ name: 'Focused review', tradeoff: 'Less density, clearer approval boundary' }, { name: 'Dense review', tradeoff: 'More detail, slower to scan' }],
  affected_task_ids: [active.task_id], gated_task_ids: [active.task_id]
});

// The recording reset must restore the same identities, not merely equivalent
// rows. IDs are otherwise random in the product database, so normalize only
// this disposable profile after every referenced record has been created.
const sql = db.db;
const releaseTaskId = 'task-demo-release-review';
const recapTaskId = 'task-demo-decision-recap';
const sessionId = 'session-demo-release-review';
const attemptId = 'attempt-demo-release-review';
sql.exec('PRAGMA foreign_keys = OFF');
try {
  const replaceTask = (from: string, to: string) => {
    for (const table of ['task_folders', 'task_inputs', 'assignments', 'plan_proposals', 'sessions', 'capacity_waits', 'task_thread_entries', 'guidance_records', 'inbox_requests', 'task_delivery_baselines', 'demo_recipes', 'task_delivery_overrides', 'delivery_attempts']) {
      try { sql.prepare(`UPDATE ${table} SET task_id=? WHERE task_id=?`).run(to, from); } catch {}
    }
    sql.prepare('UPDATE decision_versions SET affected_task_ids_json=REPLACE(affected_task_ids_json, ?, ?), gated_task_ids_json=REPLACE(gated_task_ids_json, ?, ?)').run(from, to, from, to);
    sql.prepare('UPDATE tasks SET task_id=? WHERE task_id=?').run(to, from);
  };
  replaceTask(active.task_id, releaseTaskId);
  replaceTask(queued.task_id, recapTaskId);
  for (const table of ['attempts', 'follow_up_messages', 'continuation_records']) {
    try { sql.prepare(`UPDATE ${table} SET session_id=? WHERE session_id=?`).run(sessionId, saved.session_id); } catch {}
  }
  sql.prepare('UPDATE sessions SET session_id=? WHERE session_id=?').run(sessionId, saved.session_id);
  for (const table of ['worker_leases', 'capacity_slots', 'attempt_events', 'continuation_records']) {
    try { sql.prepare(`UPDATE ${table} SET attempt_id=? WHERE attempt_id=?`).run(attemptId, saved.attempt_id); } catch {}
  }
  sql.prepare('UPDATE attempts SET attempt_id=? WHERE attempt_id=?').run(attemptId, saved.attempt_id);
} finally {
  sql.exec('PRAGMA foreign_keys = ON');
}

const board = db.taskBoard();
const release = db.taskThread(releaseTaskId)!;
const recap = board.find((task: any) => task.task_id === recapTaskId);
const inProgressBoard = board.find((task: any) => task.task_id === inProgress.task_id);
const completeBoard = board.find((task: any) => task.task_id === complete.task_id);
const savedDetail = db.executionDetail(attemptId);
assert.equal(release.task_id, releaseTaskId);
assert.equal(savedDetail.session_id, sessionId);
assert.equal(savedDetail.task_id, releaseTaskId);
assert.equal(release.assignments[0].employee_id, employee.employee_id);
assert.equal(recap?.employee_id, employee.employee_id);
assert.equal(recap?.working_state, 'waiting for capacity');
assert.equal(inProgressBoard?.working_state, 'working');
assert.equal(completeBoard?.working_state, 'complete');
assert.ok(release.thread.decisions.some((meeting: any) => meeting.decision_id === decision.decision_id));
assert.ok(release.thread.requests.some((request: any) => request.decision_id === decision.decision_id && request.status === 'pending'));

console.log(JSON.stringify({ data_dir: dataDir, project_id: project.project_id, employee_id: employee.employee_id, active_task_id: releaseTaskId, queued_task_id: recapTaskId, decision_id: decision.decision_id, saved_session_id: sessionId, saved_attempt_id: attemptId, reset: args.has('--reset') }, null, 2));
db.close();
