import { capacityPolicy, localMeasurement, type Measurement } from './capacity.js';
import { DatabaseSync } from 'node:sqlite';
import { redactCodexText } from './redaction.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ServiceError } from './types.js';

export type SqlValue = string | number | null;
export interface ProjectRow { project_id: string; name: string; status: 'active' | 'archived'; created_at: string; archived_at: string | null; }
export interface FolderRow { folder_id: string; project_id: string; canonical_path: string; display_path: string; availability: 'available' | 'unavailable'; unavailable_reason: string | null; created_at: string; updated_at: string; }

const migrations = [
  {
    id: '001_domain_v1', classification: 'forward-only', sql: `
      CREATE TABLE projects (project_id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived')), created_at TEXT NOT NULL, archived_at TEXT);
      CREATE TABLE project_delivery_settings (project_id TEXT PRIMARY KEY REFERENCES projects(project_id), default_branch TEXT, delivery_mode TEXT NOT NULL DEFAULT 'review', notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
      CREATE TABLE local_folders (folder_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), canonical_path TEXT NOT NULL UNIQUE, display_path TEXT NOT NULL, availability TEXT NOT NULL CHECK(availability IN ('available','unavailable')), unavailable_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX local_folders_project_idx ON local_folders(project_id);
      CREATE TABLE employees (employee_id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE tasks (task_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX tasks_project_idx ON tasks(project_id);
      CREATE TABLE assignments (assignment_id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(employee_id), task_id TEXT NOT NULL REFERENCES tasks(task_id), assigned_at TEXT NOT NULL, ended_at TEXT, UNIQUE(employee_id, task_id, ended_at));
      CREATE TABLE task_folders (task_id TEXT NOT NULL REFERENCES tasks(task_id), folder_id TEXT NOT NULL REFERENCES local_folders(folder_id), is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)), PRIMARY KEY(task_id, folder_id));
      CREATE UNIQUE INDEX task_one_primary_folder ON task_folders(task_id) WHERE is_primary = 1;
      CREATE TABLE sessions (session_id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(task_id), employee_id TEXT NOT NULL REFERENCES employees(employee_id), purpose TEXT NOT NULL, continuation_state TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL);
      CREATE TABLE attempts (attempt_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(session_id), provider_thread_id TEXT, provider_turn_id TEXT, provider_item_id TEXT, provider_process_id TEXT, workspace_set_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
    `
  }
  , {
    id: '002_office_shell_v1', classification: 'forward-only', sql: `
      ALTER TABLE employees ADD COLUMN appearance_recipe TEXT NOT NULL DEFAULT '{}';
      CREATE TABLE office_preferences (preference_id TEXT PRIMARY KEY, map_treatment TEXT NOT NULL CHECK(map_treatment IN ('warm','cool','editorial')), reduced_motion INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
      INSERT INTO office_preferences (preference_id, map_treatment, reduced_motion, updated_at) VALUES ('local-user', 'warm', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      CREATE TABLE inbox_requests (request_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), employee_id TEXT REFERENCES employees(employee_id), task_id TEXT REFERENCES tasks(task_id), kind TEXT NOT NULL, summary TEXT NOT NULL, detail TEXT NOT NULL, blocks TEXT NOT NULL, source TEXT NOT NULL CHECK(source = 'simulated'), status TEXT NOT NULL CHECK(status IN ('pending','resolved')), created_at TEXT NOT NULL, resolved_at TEXT);
      CREATE INDEX inbox_requests_status_idx ON inbox_requests(status, created_at DESC);
    `
  }
  , {
    id: '003_codex_execution_v1', classification: 'forward-only', sql: `
      CREATE TABLE harness_connections (connection_id TEXT PRIMARY KEY, adapter TEXT NOT NULL, cli_version TEXT, readiness_state TEXT NOT NULL, readiness_detail TEXT NOT NULL, checked_at TEXT NOT NULL);
      CREATE TABLE worker_leases (lease_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id), state TEXT NOT NULL CHECK(state IN ('active','stopping','released','lost')), heartbeat_at TEXT NOT NULL, released_at TEXT, stop_reason TEXT);
      CREATE TABLE attempt_events (event_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id), sequence INTEGER NOT NULL, at TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL, adapter TEXT NOT NULL, provider_event_id TEXT, UNIQUE(attempt_id, sequence), UNIQUE(adapter, provider_event_id));
      CREATE TABLE follow_up_messages (message_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(session_id), content TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','delivering','delivered','failed','cancelled')), queued_at TEXT NOT NULL, delivered_at TEXT, delivery_attempt_id TEXT);
      CREATE INDEX attempt_events_attempt_idx ON attempt_events(attempt_id, sequence);
      CREATE INDEX follow_up_messages_session_idx ON follow_up_messages(session_id, queued_at);
    `
  }
  , {
    id: '004_planning_guidance_v1', classification: 'forward-only', sql: `
      CREATE TABLE plan_proposals (plan_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), task_id TEXT NOT NULL REFERENCES tasks(task_id), version INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','superseded','rejected')), summary TEXT NOT NULL, milestones_json TEXT NOT NULL, acceptance_json TEXT NOT NULL, dependencies_json TEXT NOT NULL, proposed_at TEXT NOT NULL, approved_at TEXT, approved_by TEXT, UNIQUE(project_id, version));
      CREATE INDEX plan_proposals_task_idx ON plan_proposals(task_id, status);
      CREATE TABLE guidance_records (guidance_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), scope TEXT NOT NULL CHECK(scope IN ('project','task')), task_id TEXT REFERENCES tasks(task_id), content TEXT NOT NULL, provenance TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('active','corrected','retired')), replaces_guidance_id TEXT REFERENCES guidance_records(guidance_id), created_at TEXT NOT NULL, retired_at TEXT);
      CREATE INDEX guidance_records_selection_idx ON guidance_records(project_id, task_id, state, created_at);
      ALTER TABLE inbox_requests ADD COLUMN response_text TEXT;
      ALTER TABLE inbox_requests ADD COLUMN message_id TEXT;
    `
  }
  , {
    id: '005_real_inbox_sources_v1', classification: 'forward-only', sql: `
      CREATE TABLE inbox_requests_v2 (request_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), employee_id TEXT REFERENCES employees(employee_id), task_id TEXT REFERENCES tasks(task_id), kind TEXT NOT NULL, summary TEXT NOT NULL, detail TEXT NOT NULL, blocks TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('simulated','codex')), status TEXT NOT NULL CHECK(status IN ('pending','resolved')), created_at TEXT NOT NULL, resolved_at TEXT, response_text TEXT, message_id TEXT);
      INSERT INTO inbox_requests_v2 SELECT request_id, project_id, employee_id, task_id, kind, summary, detail, blocks, source, status, created_at, resolved_at, response_text, message_id FROM inbox_requests;
      DROP TABLE inbox_requests;
      ALTER TABLE inbox_requests_v2 RENAME TO inbox_requests;
      CREATE INDEX inbox_requests_status_idx ON inbox_requests(status, created_at DESC);
    `
  }
, { id: '006_environment_capacity_v1', classification: 'forward-only', sql: `
 CREATE TABLE execution_hosts (host_id TEXT PRIMARY KEY, measurement_json TEXT, user_ceiling INTEGER);
 INSERT INTO execution_hosts VALUES ('local', NULL, NULL);
 CREATE TABLE execution_environments (environment_id TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES execution_hosts(host_id), name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('local','coder')), health TEXT NOT NULL, fixture INTEGER NOT NULL DEFAULT 0);
 INSERT INTO execution_environments VALUES ('local','local','This Mac','local','available',0);
 CREATE TABLE employee_environments (employee_id TEXT PRIMARY KEY REFERENCES employees(employee_id), environment_id TEXT NOT NULL REFERENCES execution_environments(environment_id));
 CREATE TABLE capacity_slots (attempt_id TEXT PRIMARY KEY REFERENCES attempts(attempt_id), host_id TEXT NOT NULL REFERENCES execution_hosts(host_id), environment_id TEXT NOT NULL REFERENCES execution_environments(environment_id), state TEXT NOT NULL CHECK(state IN ('reserved','active','released')), owner_pid INTEGER);
 CREATE TABLE capacity_waits (task_id TEXT PRIMARY KEY REFERENCES tasks(task_id), reason TEXT NOT NULL, checked_at TEXT NOT NULL);
 ` }
] as const;

const now = () => new Date().toISOString();
const id = (kind: string) => `${kind}_${randomUUID()}`;
const recipeFor = (employeeId: string) => JSON.stringify({
  body: 'base-01', skin: ['umber-02', 'sienna-01', 'golden-01'][employeeId.charCodeAt(4) % 3],
  hair: ['short-auburn-03', 'curl-dark-01', 'crop-ink-01'][employeeId.charCodeAt(8) % 3],
  top: ['cardigan-navy-01', 'shirt-cream-01', 'overshirt-moss-01'][employeeId.charCodeAt(12) % 3],
  bottom: 'trousers-charcoal-01', accent: ['moss-01', 'terracotta-01', 'indigo-01'][employeeId.charCodeAt(16) % 3], accessory: 'glasses-round-01'
});

export class PixelDatabase {
  readonly db: DatabaseSync;
  constructor(file: string) { mkdirSync(dirname(file), { recursive: true }); this.db = new DatabaseSync(file); this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;'); this.migrate(); this.measureHost(); }
  private migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (migration_id TEXT PRIMARY KEY, checksum TEXT NOT NULL, classification TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (const migration of migrations) {
      const checksum = createHash('sha256').update(migration.sql).digest('hex');
      const seen = this.db.prepare('SELECT checksum FROM schema_migrations WHERE migration_id = ?').get(migration.id) as { checksum: string } | undefined;
      if (seen && seen.checksum !== checksum) throw new Error(`Migration checksum mismatch for ${migration.id}`);
      if (!seen) {
        this.db.exec('BEGIN IMMEDIATE');
        try { this.db.exec(migration.sql); this.db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?, ?)').run(migration.id, checksum, migration.classification, now()); this.db.exec('COMMIT'); }
        catch (error) { this.db.exec('ROLLBACK'); throw error; }
      }
    }
  }
  close() { this.db.close(); }
  createProject(name: string) {
    if (!name.trim()) throw new ServiceError('VALIDATION_ERROR', 'Project name is required');
    const project_id = id('prj'), at = now();
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?)').run(project_id, name.trim(), 'active', at, null); this.db.prepare('INSERT INTO project_delivery_settings VALUES (?, ?, ?, ?, ?)').run(project_id, null, 'review', '', at); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getProject(project_id)!;
  }
  getProject(projectId: string) { return this.db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId) as unknown as ProjectRow | undefined; }
  listProjects() { return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as unknown as ProjectRow[]; }
  setProjectStatus(projectId: string, status: 'active' | 'archived') {
    if (!this.getProject(projectId)) throw new ServiceError('NOT_FOUND', 'Project not found', { project_id: projectId }, 404);
    const at = now(); this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE projects SET status = ?, archived_at = ? WHERE project_id = ?').run(status, status === 'archived' ? at : null, projectId);
      if (status === 'archived') this.db.prepare(`UPDATE assignments SET ended_at = ? WHERE ended_at IS NULL AND task_id IN (SELECT task_id FROM tasks WHERE project_id = ?)` ).run(at, projectId);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getProject(projectId)!;
  }
  delivery(projectId: string) { return this.db.prepare('SELECT * FROM project_delivery_settings WHERE project_id = ?').get(projectId); }
  updateDelivery(projectId: string, values: { default_branch?: string | null; delivery_mode?: string; notes?: string }) { if (!this.getProject(projectId)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); const old = this.delivery(projectId) as Record<string, SqlValue>; this.db.prepare('UPDATE project_delivery_settings SET default_branch = ?, delivery_mode = ?, notes = ?, updated_at = ? WHERE project_id = ?').run(values.default_branch ?? old.default_branch, values.delivery_mode ?? old.delivery_mode, values.notes ?? old.notes, now(), projectId); return this.delivery(projectId); }
  listFolders(projectId: string) { return this.db.prepare('SELECT * FROM local_folders WHERE project_id = ? ORDER BY created_at').all(projectId) as unknown as FolderRow[]; }
  folderByPath(canonical: string) { return this.db.prepare('SELECT * FROM local_folders WHERE canonical_path = ?').get(canonical) as unknown as FolderRow | undefined; }
  attachFolder(projectId: string, canonical: string, display: string) {
    if (!this.getProject(projectId)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404);
    const existing = this.folderByPath(canonical); if (existing) { if (existing.project_id === projectId) return existing; throw new ServiceError('FOLDER_ALREADY_ATTACHED', 'This folder is already attached to another project', { folder_id: existing.folder_id }, 409); }
    for (const folder of this.listFolders(projectId)) if (canonical.startsWith(`${folder.canonical_path}/`) || folder.canonical_path.startsWith(`${canonical}/`)) throw new ServiceError('OVERLAPPING_FOLDER', 'A parent or child folder is already attached to this project', { existing_folder_id: folder.folder_id }, 409);
    const folder_id = id('fld'), at = now(); this.db.prepare('INSERT INTO local_folders VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(folder_id, projectId, canonical, display, 'available', null, at, at); return this.db.prepare('SELECT * FROM local_folders WHERE folder_id = ?').get(folder_id) as unknown as FolderRow;
  }
  setFolderAvailability(folderId: string, availability: 'available' | 'unavailable', reason: string | null = null) { this.db.prepare('UPDATE local_folders SET availability = ?, unavailable_reason = ?, updated_at = ? WHERE folder_id = ?').run(availability, reason, now(), folderId); }
  relinkFolder(folderId: string, canonical: string, display: string) { const folder = this.db.prepare('SELECT * FROM local_folders WHERE folder_id = ?').get(folderId) as unknown as FolderRow | undefined; if (!folder) throw new ServiceError('NOT_FOUND', 'Folder not found', {}, 404); const clash = this.folderByPath(canonical); if (clash && clash.folder_id !== folderId) throw new ServiceError('FOLDER_ALREADY_ATTACHED', 'That folder is already attached', { folder_id: clash.folder_id }, 409); for (const other of this.listFolders(folder.project_id)) if (other.folder_id !== folderId && (canonical.startsWith(`${other.canonical_path}/`) || other.canonical_path.startsWith(`${canonical}/`))) throw new ServiceError('OVERLAPPING_FOLDER', 'A parent or child folder is already attached to this project', { existing_folder_id: other.folder_id }, 409); this.db.prepare('UPDATE local_folders SET canonical_path = ?, display_path = ?, availability = ?, unavailable_reason = NULL, updated_at = ? WHERE folder_id = ?').run(canonical, display, 'available', now(), folderId); return this.db.prepare('SELECT * FROM local_folders WHERE folder_id = ?').get(folderId) as unknown as FolderRow; }
  createEmployee(input: { name: string; title?: string; color?: string }) { if (!input.name.trim()) throw new ServiceError('VALIDATION_ERROR', 'Staff name is required'); const employee_id = id('emp'), at = now(); this.db.prepare('INSERT INTO employees VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(employee_id, input.name.trim(), input.title?.trim() || 'Harness operator', input.color || '#587d61', 1, at, at, recipeFor(employee_id)); return this.employeeDetail(employee_id)!; }
  getEmployee(employeeId: string) { return this.db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employeeId); }
  employeeDetail(employeeId: string): Record<string, any> | undefined {
    const employee = this.getEmployee(employeeId) as Record<string, unknown> | undefined; if (!employee) return undefined;
    const assignment = this.db.prepare(`SELECT a.*, t.title AS task_title, t.project_id, p.name AS project_name FROM assignments a JOIN tasks t ON t.task_id = a.task_id JOIN projects p ON p.project_id = t.project_id WHERE a.employee_id = ? AND a.ended_at IS NULL ORDER BY a.assigned_at DESC LIMIT 1`).get(employeeId);
    const history = this.db.prepare(`SELECT a.*, t.title AS task_title, p.name AS project_name FROM assignments a JOIN tasks t ON t.task_id = a.task_id JOIN projects p ON p.project_id = t.project_id WHERE a.employee_id = ? ORDER BY a.assigned_at DESC`).all(employeeId);
    return { ...employee, environment: this.employeeEnvironment(employeeId), appearance_recipe: JSON.parse(String(employee.appearance_recipe || '{}')), assignment, history };
  }
  listEmployees() { return (this.db.prepare('SELECT employee_id FROM employees ORDER BY created_at').all() as Array<{ employee_id: string }>).map(({ employee_id }) => this.employeeDetail(employee_id)); }
  updateEmployee(employeeId: string, input: { name?: string; title?: string; color?: string; active?: boolean }) { const old = this.getEmployee(employeeId) as Record<string, SqlValue> | undefined; if (!old) throw new ServiceError('NOT_FOUND', 'Staff member not found', {}, 404); this.db.prepare('UPDATE employees SET name = ?, title = ?, color = ?, active = ?, updated_at = ? WHERE employee_id = ?').run(input.name?.trim() || old.name, input.title?.trim() || old.title, input.color || old.color, input.active === undefined ? old.active : Number(input.active), now(), employeeId); return this.employeeDetail(employeeId); }
  updateAppearance(employeeId: string, recipe: Record<string, string>) { if (!this.getEmployee(employeeId)) throw new ServiceError('NOT_FOUND', 'Staff member not found', {}, 404); const valid = ['body', 'skin', 'hair', 'top', 'bottom', 'accent', 'accessory']; for (const key of valid) if (typeof recipe[key] !== 'string' || !recipe[key].trim()) throw new ServiceError('VALIDATION_ERROR', `Appearance recipe needs ${key}`); this.db.prepare('UPDATE employees SET appearance_recipe = ?, updated_at = ? WHERE employee_id = ?').run(JSON.stringify(Object.fromEntries(valid.map((key) => [key, recipe[key].trim()]))), now(), employeeId); return this.employeeDetail(employeeId); }
  createTask(input: { project_id: string; title: string; employee_id?: string; folder_ids: string[]; primary_folder_id: string }) { if (!input.title.trim()) throw new ServiceError('VALIDATION_ERROR', 'Task title is required'); if (!this.getProject(input.project_id)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); const uniqueFolders = [...new Set(input.folder_ids)]; if (!uniqueFolders.length || !uniqueFolders.includes(input.primary_folder_id)) throw new ServiceError('VALIDATION_ERROR', 'Select task folders and one primary folder'); for (const folderId of uniqueFolders) { const folder = this.db.prepare('SELECT * FROM local_folders WHERE folder_id = ?').get(folderId) as unknown as FolderRow | undefined; if (!folder || folder.project_id !== input.project_id) throw new ServiceError('INVALID_FOLDER_SELECTION', 'Each task folder must belong to this project', { folder_id: folderId }); if (folder.availability !== 'available') throw new ServiceError('FOLDER_UNAVAILABLE', 'Relink unavailable folders before assigning them', { folder_id: folderId }); }
    if (input.employee_id && !this.getEmployee(input.employee_id)) throw new ServiceError('NOT_FOUND', 'Staff member not found', {}, 404);
    if (input.employee_id && this.employeeDetail(input.employee_id)?.assignment) throw new ServiceError('EMPLOYEE_BUSY', 'Finish or archive the current assignment before assigning this employee again', { employee_id: input.employee_id }, 409);
    const task_id = id('tsk'), at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)').run(task_id, input.project_id, input.title.trim(), 'planned', at, at); for (const folderId of uniqueFolders) this.db.prepare('INSERT INTO task_folders VALUES (?, ?, ?)').run(task_id, folderId, Number(folderId === input.primary_folder_id)); if (input.employee_id) this.db.prepare('INSERT INTO assignments VALUES (?, ?, ?, ?, ?)').run(id('asg'), input.employee_id, task_id, at, null); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.taskDetail(task_id)!;
  }
  updateTaskFolders(taskId: string, input: { folder_ids: string[]; primary_folder_id: string }) {
    const task = this.taskDetail(taskId) as (Record<string, unknown> & { project_id: string }) | undefined; if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    const uniqueFolders = [...new Set(input.folder_ids)]; if (!uniqueFolders.length || !uniqueFolders.includes(input.primary_folder_id)) throw new ServiceError('VALIDATION_ERROR', 'Select task folders and one primary folder');
    for (const folderId of uniqueFolders) { const folder = this.db.prepare('SELECT * FROM local_folders WHERE folder_id = ?').get(folderId) as unknown as FolderRow | undefined; if (!folder || folder.project_id !== task.project_id) throw new ServiceError('INVALID_FOLDER_SELECTION', 'Each task folder must belong to this project', { folder_id: folderId }); if (folder.availability !== 'available') throw new ServiceError('FOLDER_UNAVAILABLE', 'Relink unavailable folders before selecting them', { folder_id: folderId }); }
    this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare('DELETE FROM task_folders WHERE task_id = ?').run(taskId); for (const folderId of uniqueFolders) this.db.prepare('INSERT INTO task_folders VALUES (?, ?, ?)').run(taskId, folderId, Number(folderId === input.primary_folder_id)); this.db.prepare('UPDATE tasks SET updated_at = ? WHERE task_id = ?').run(now(), taskId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.taskDetail(taskId)!;
  }
  taskDetail(taskId: string): Record<string, any> | undefined { const task = this.db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined; if (!task) return undefined; return { ...task, folders: this.db.prepare('SELECT f.*, tf.is_primary FROM task_folders tf JOIN local_folders f ON f.folder_id = tf.folder_id WHERE tf.task_id = ?').all(taskId), assignments: this.db.prepare('SELECT a.*, e.name AS employee_name FROM assignments a JOIN employees e ON e.employee_id = a.employee_id WHERE a.task_id = ? AND a.ended_at IS NULL').all(taskId), plans: this.listPlansForTask(taskId), guidance: this.guidanceForTask(String(task.project_id), taskId) }; }
  projectDetail(projectId: string) { const project = this.getProject(projectId); if (!project) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); return { ...project, delivery: this.delivery(projectId), folders: this.listFolders(projectId), tasks: this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map((task) => this.taskDetail((task as { task_id: string }).task_id)) }; }
  completeTask(taskId: string) { const task = this.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404); const at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare(`UPDATE tasks SET status = 'complete', updated_at = ? WHERE task_id = ?`).run(at, taskId); this.db.prepare('UPDATE assignments SET ended_at = ? WHERE task_id = ? AND ended_at IS NULL').run(at, taskId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.taskDetail(taskId)!; }
  reopenTask(taskId: string) {
    const task = this.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    const previous = this.db.prepare('SELECT assignment_id, employee_id FROM assignments WHERE task_id = ? ORDER BY assigned_at DESC LIMIT 1').get(taskId) as { assignment_id: string; employee_id: string } | undefined;
    if (previous && this.employeeDetail(previous.employee_id)?.assignment) throw new ServiceError('EMPLOYEE_BUSY', 'The previously assigned colleague is currently working on another task', { employee_id: previous.employee_id }, 409);
    const at = now(); this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`UPDATE tasks SET status = 'planned', updated_at = ? WHERE task_id = ?`).run(at, taskId);
      if (previous) this.db.prepare('UPDATE assignments SET ended_at = NULL WHERE assignment_id = ?').run(previous.assignment_id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.taskDetail(taskId)!;
  }
  activeAttempt() { return this.db.prepare(`SELECT a.*, s.task_id, s.employee_id, l.lease_id, l.state AS lease_state FROM attempts a JOIN sessions s ON s.session_id = a.session_id JOIN worker_leases l ON l.attempt_id = a.attempt_id WHERE l.state IN ('active','stopping') ORDER BY a.created_at DESC LIMIT 1`).get() as Record<string, unknown> | undefined; }
  reconcileActiveExecutions(reason = 'service_restart') {
    const attempts = this.db.prepare(`SELECT attempt_id FROM worker_leases WHERE state IN ('active','stopping')`).all() as Array<{ attempt_id: string }>;
    let released = 0;
    for (const attempt of attempts) {
      try { this.reconcileCapacity(attempt.attempt_id); this.releaseExecution(attempt.attempt_id, reason, 'lost'); released++; }
      catch (error) { if (!(error instanceof ServiceError) || error.code !== 'OWNER_STILL_ALIVE') throw error; }
    }
    for (const slot of this.db.prepare(`SELECT c.attempt_id FROM capacity_slots c JOIN worker_leases l USING(attempt_id) WHERE c.state != 'released' AND l.state NOT IN ('active','stopping')`).all() as Array<{ attempt_id: string }>) {
      try { this.reconcileCapacity(slot.attempt_id); } catch (error) { if (!(error instanceof ServiceError) || error.code !== 'OWNER_STILL_ALIVE') throw error; }
    }
    return released;
  }
  executionDetail(attemptId: string): Record<string, any> {
    const attempt = this.db.prepare(`SELECT a.*, s.task_id, s.employee_id, s.purpose, s.continuation_state, t.title AS task_title, e.name AS employee_name, l.lease_id, l.state AS lease_state, l.stop_reason FROM attempts a JOIN sessions s ON s.session_id = a.session_id JOIN tasks t ON t.task_id = s.task_id JOIN employees e ON e.employee_id = s.employee_id LEFT JOIN worker_leases l ON l.attempt_id = a.attempt_id WHERE a.attempt_id = ?`).get(attemptId) as Record<string, unknown> | undefined;
    if (!attempt) throw new ServiceError('NOT_FOUND', 'Execution not found', {}, 404);
    return { ...attempt, workspace_set: JSON.parse(String(attempt.workspace_set_json)), events: this.db.prepare('SELECT event_id, sequence, at, kind, payload_json, adapter FROM attempt_events WHERE attempt_id = ? ORDER BY sequence').all(attemptId).map((event: Record<string, unknown>) => ({ ...event, payload: JSON.parse(String(event.payload_json)) })), messages: this.db.prepare('SELECT * FROM follow_up_messages WHERE session_id = ? ORDER BY queued_at').all(String(attempt.session_id)) };
  }
  startExecution(input: { task_id: string; employee_id: string; purpose: string; workspace_set: string[] }) {
    const task = this.taskDetail(input.task_id); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    if (task.status === 'complete' || this.getProject(String(task.project_id))?.status !== 'active') throw new ServiceError('TASK_NOT_EXECUTABLE', 'Reopen the task and project first.', {}, 409);
    if (!task.assignments.some((assignment: { employee_id: string }) => assignment.employee_id === input.employee_id)) throw new ServiceError('EXECUTION_OWNER_REQUIRED', 'Select the employee assigned to this task before launching', {}, 409);
    const env = this.employeeEnvironment(input.employee_id);
    if (env.kind !== 'local') throw new ServiceError('REMOTE_UNAVAILABLE', 'Coder execution is not connected; milestone 6 is required.', {}, 409);
    const at = now(), session_id = id('ses'), attempt_id = id('att'), lease_id = id('lease');
    this.db.exec('BEGIN IMMEDIATE'); try {
      const capacity = this.hostCapacity(String(env.host_id));
      if (capacity.occupied >= capacity.effective_limit || this.activeAttempt()) {
        const reason = capacity.occupied ? 'Waiting for capacity: an active or reserved session owns the sequential slot.' : `Waiting for capacity: ${capacity.reason}`;
        this.db.prepare('INSERT OR REPLACE INTO capacity_waits VALUES (?, ?, ?)').run(input.task_id, reason, at);
        this.db.exec('COMMIT');
        throw new ServiceError(this.activeAttempt() ? 'WORKER_LEASE_CONFLICT' : 'WAITING_FOR_CAPACITY', reason, { capacity }, 409);
      }
      this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)').run(session_id, input.task_id, input.employee_id, redactCodexText(input.purpose), 'running', at);
      this.db.prepare('INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(attempt_id, session_id, null, null, null, null, JSON.stringify(input.workspace_set), at);
      this.db.prepare('INSERT INTO worker_leases VALUES (?, ?, ?, ?, ?, ?)').run(lease_id, attempt_id, 'active', at, null, null);
      this.db.prepare('INSERT INTO capacity_slots VALUES (?, ?, ?, ?, NULL)').run(attempt_id, env.host_id, env.environment_id, 'reserved');
      this.db.prepare('DELETE FROM capacity_waits WHERE task_id = ?').run(input.task_id);
      this.db.exec('COMMIT');
    } catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
    return this.executionDetail(attempt_id);
  }
  measureHost(hostId = 'local', sample: Measurement | null = localMeasurement()) { this.db.prepare('UPDATE execution_hosts SET measurement_json = ? WHERE host_id = ?').run(sample ? JSON.stringify(sample) : null, hostId); }
  hostCapacity(hostId: string): any {
    const host = this.db.prepare('SELECT * FROM execution_hosts WHERE host_id = ?').get(hostId) as any;
    if (!host) throw new ServiceError('NOT_FOUND', 'Environment host not found', {}, 404);
    const slots = this.db.prepare("SELECT state, COUNT(*) AS count FROM capacity_slots WHERE host_id = ? AND state != 'released' GROUP BY state").all(hostId) as any[];
    const reserved = Number(slots.find(s => s.state === 'reserved')?.count || 0), active = Number(slots.find(s => s.state === 'active')?.count || 0);
    return { host_id: hostId, ...capacityPolicy(host.measurement_json ? JSON.parse(host.measurement_json) : null, host.user_ceiling), reserved, active, occupied: reserved + active };
  }
  environments() { return this.db.prepare('SELECT * FROM execution_environments').all().map((env: any) => ({ ...env, capacity: this.hostCapacity(env.host_id) })); }
  employeeEnvironment(employeeId: string): any { return this.db.prepare("SELECT * FROM execution_environments WHERE environment_id = COALESCE((SELECT environment_id FROM employee_environments WHERE employee_id = ?), 'local')").get(employeeId); }
  createRemoteEnvironment(name: string) { if (!name.trim()) throw new ServiceError('VALIDATION_ERROR', 'Environment name required'); const key = id('coder'); this.db.prepare('INSERT INTO execution_hosts VALUES (?, NULL, NULL)').run(key); this.db.prepare('INSERT INTO execution_environments VALUES (?, ?, ?, ?, ?, 0)').run(key, key, name.trim(), 'coder', 'not connected'); return this.environments(); }
  bindEnvironment(employeeId: string, environmentId: string) { if (!this.getEmployee(employeeId) || !this.environments().some(e => e.environment_id === environmentId)) throw new ServiceError('NOT_FOUND', 'Coworker or environment not found', {}, 404); if (this.db.prepare("SELECT 1 FROM capacity_slots c JOIN attempts a USING(attempt_id) JOIN sessions s USING(session_id) WHERE s.employee_id = ? AND c.state != 'released'").get(employeeId)) throw new ServiceError('WORKER_LEASE_CONFLICT', 'Stop and reconcile this coworker before changing location.', {}, 409); this.db.prepare('INSERT OR REPLACE INTO employee_environments VALUES (?, ?)').run(employeeId, environmentId); return this.employeeDetail(employeeId); }
  setCapacityCeiling(hostId: string, value: unknown) { if (value !== null && (!Number.isInteger(value) || Number(value) < 0)) throw new ServiceError('VALIDATION_ERROR', 'Ceiling must be a nonnegative integer or null'); this.hostCapacity(hostId); this.db.prepare('UPDATE execution_hosts SET user_ceiling = ? WHERE host_id = ?').run(value as number | null, hostId); return this.hostCapacity(hostId); }
  activateCapacity(attemptId: string, pid: number) { this.db.prepare("UPDATE capacity_slots SET state = 'active', owner_pid = ? WHERE attempt_id = ? AND state = 'reserved'").run(pid, attemptId); }
  reconcileCapacity(attemptId: string) {
    const slot = this.db.prepare('SELECT * FROM capacity_slots WHERE attempt_id = ?').get(attemptId) as any;
    if (slot?.owner_pid) { try { process.kill(slot.owner_pid, 0); throw new ServiceError('OWNER_STILL_ALIVE', 'Capacity remains occupied until the owned process exits.', {}, 409); } catch (e: any) { if (e.code !== 'ESRCH') throw e; } }
    this.db.prepare("UPDATE capacity_slots SET state = 'released' WHERE attempt_id = ?").run(attemptId);
  }
  taskBoard(): any[] { return this.db.prepare('SELECT task_id FROM tasks ORDER BY created_at DESC').all().map((row: any) => {
    const task = this.taskDetail(row.task_id) as any;
    const owner = task.assignments[0] || this.db.prepare('SELECT * FROM assignments WHERE task_id = ? ORDER BY assigned_at DESC LIMIT 1').get(task.task_id) as any;
    const env = owner ? this.employeeEnvironment(owner.employee_id) : null;
    const latest = this.db.prepare('SELECT a.attempt_id FROM attempts a JOIN sessions s USING(session_id) WHERE s.task_id = ? ORDER BY a.created_at DESC LIMIT 1').get(task.task_id) as any;
    const attempt = latest ? this.executionDetail(latest.attempt_id) : null;
    const wait = this.db.prepare('SELECT * FROM capacity_waits WHERE task_id = ?').get(task.task_id) as any;
    const request = this.listInbox('pending').find((r: any) => r.task_id === task.task_id) as any;
    const working = attempt && ['active','stopping'].includes(String(attempt.lease_state));
    const reason = task.status === 'complete' ? '' : request?.blocks || (working ? '' : !this.approvedPlanForTask(task.task_id) ? 'Current plan approval required.' : !owner ? 'Assign a coworker.' : env?.kind === 'coder' ? 'Coder not connected; execution arrives in milestone 6.' : wait?.reason || '');
    return { ...task, project_name: this.getProject(task.project_id)?.name, employee_id: owner?.employee_id || null, employee_name: owner ? this.getEmployee(owner.employee_id)?.name : null, environment: env, attempt, blocking_reason: reason, working_state: task.status === 'complete' ? 'complete' : working ? 'working' : reason ? (wait && !request && this.approvedPlanForTask(task.task_id) && env?.kind === 'local' ? 'waiting for capacity' : 'blocked') : 'planned' };
  }); }
  setProviderIdentity(attemptId: string, values: { threadId?: string | null; turnId?: string | null; itemId?: string | null; processId?: string | null }) { this.db.prepare('UPDATE attempts SET provider_thread_id = COALESCE(?, provider_thread_id), provider_turn_id = COALESCE(?, provider_turn_id), provider_item_id = COALESCE(?, provider_item_id), provider_process_id = COALESCE(?, provider_process_id) WHERE attempt_id = ?').run(values.threadId ?? null, values.turnId ?? null, values.itemId ?? null, values.processId ?? null, attemptId); }
  appendEvent(attemptId: string, kind: string, payload: Record<string, unknown>, providerEventId: string | null = null) { const previous = this.db.prepare('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM attempt_events WHERE attempt_id = ?').get(attemptId) as { sequence: number }; if (providerEventId && this.db.prepare('SELECT 1 FROM attempt_events WHERE adapter = ? AND provider_event_id = ?').get('codex-app-server', providerEventId)) return; this.db.prepare('INSERT INTO attempt_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id('evt'), attemptId, previous.sequence + 1, now(), kind, redactCodexText(JSON.stringify(payload)), 'codex-app-server', providerEventId); }
  queueMessage(sessionId: string, content: string) { const message_id = id('msg'), at = now(); this.db.prepare('INSERT INTO follow_up_messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(message_id, sessionId, redactCodexText(content), 'queued', at, null, null); return message_id; }
  markMessage(messageId: string, state: 'delivering' | 'delivered' | 'failed' | 'cancelled', attemptId?: string) { this.db.prepare('UPDATE follow_up_messages SET state = ?, delivered_at = ?, delivery_attempt_id = ? WHERE message_id = ?').run(state, state === 'delivered' ? now() : null, attemptId ?? null, messageId); }
  releaseExecution(attemptId: string, reason: string, state: 'released' | 'lost' = 'released') { const at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare('UPDATE worker_leases SET state = ?, released_at = ?, stop_reason = ?, heartbeat_at = ? WHERE attempt_id = ?').run(state, at, reason, at, attemptId); this.db.prepare(`UPDATE sessions SET continuation_state = ? WHERE session_id = (SELECT session_id FROM attempts WHERE attempt_id = ?)` ).run(state === 'released' ? 'stopped' : 'lost', attemptId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  preferences() { return this.db.prepare(`SELECT * FROM office_preferences WHERE preference_id = 'local-user'`).get(); }
  updatePreferences(values: { map_treatment?: 'warm' | 'cool' | 'editorial'; reduced_motion?: boolean }) { const old = this.preferences() as { map_treatment: 'warm' | 'cool' | 'editorial'; reduced_motion: number }; const treatment = values.map_treatment ?? old.map_treatment; if (!['warm', 'cool', 'editorial'].includes(treatment)) throw new ServiceError('VALIDATION_ERROR', 'Unknown map treatment'); this.db.prepare(`UPDATE office_preferences SET map_treatment = ?, reduced_motion = ?, updated_at = ? WHERE preference_id = 'local-user'`).run(treatment, values.reduced_motion === undefined ? old.reduced_motion : Number(values.reduced_motion), now()); return this.preferences(); }
  listInbox(status?: 'pending' | 'resolved'): Record<string, any>[] { return this.db.prepare(`SELECT r.*, p.name AS project_name, e.name AS employee_name, t.title AS task_title, m.state AS message_state FROM inbox_requests r JOIN projects p ON p.project_id = r.project_id LEFT JOIN employees e ON e.employee_id = r.employee_id LEFT JOIN tasks t ON t.task_id = r.task_id LEFT JOIN follow_up_messages m ON m.message_id = r.message_id ${status ? 'WHERE r.status = ?' : ''} ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`).all(...(status ? [status] : [])); }
  createSimulatedRequest(input: { project_id: string; employee_id?: string; task_id?: string; kind?: string; summary?: string; detail?: string; blocks?: string }) { if (!this.getProject(input.project_id)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); const request_id = id('req'), at = now(); const kind = input.kind || 'clarification'; const summary = input.summary?.trim() || 'Confirm the next room priority'; const detail = input.detail?.trim() || 'This is a labeled simulated request for the Packet 1B inbox shell. It shows the reading surface for a longer technical question without sending a message, starting a worker, or approving anything. A later execution packet must replace this entry with a persisted adapter event before the office can claim that work is actually blocked or awaiting a user response.'; const blocks = input.blocks?.trim() || 'No execution is running; this only demonstrates the inbox route and its readable request-details boundary.'; this.db.prepare('INSERT INTO inbox_requests (request_id, project_id, employee_id, task_id, kind, summary, detail, blocks, source, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(request_id, input.project_id, input.employee_id || null, input.task_id || null, kind, summary, detail, blocks, 'simulated', 'pending', at, null); return this.listInbox().find((request: any) => request.request_id === request_id); }
  resolveRequest(requestId: string) { const existing = this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId); if (!existing) throw new ServiceError('NOT_FOUND', 'Inbox request not found', {}, 404); this.db.prepare(`UPDATE inbox_requests SET status = 'resolved', resolved_at = ? WHERE request_id = ?`).run(now(), requestId); return this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId); }
  createPlan(input: { project_id: string; task_id: string; summary: string; milestones?: unknown; acceptance?: unknown; dependencies?: unknown }) {
    const task = this.taskDetail(input.task_id) as { project_id: string } | undefined;
    if (!task || task.project_id !== input.project_id) throw new ServiceError('INVALID_PLAN_TASK', 'A plan must target a task in its project', {}, 409);
    if (!input.summary.trim()) throw new ServiceError('VALIDATION_ERROR', 'A plan summary is required');
    const version = Number((this.db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM plan_proposals WHERE project_id = ?').get(input.project_id) as { version: number }).version) + 1;
    const plan_id = id('plan'), at = now(); this.db.exec('BEGIN IMMEDIATE'); try {
      this.db.prepare(`UPDATE plan_proposals SET status = 'superseded' WHERE task_id = ? AND status IN ('pending', 'approved')`).run(input.task_id);
      this.db.prepare('INSERT INTO plan_proposals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(plan_id, input.project_id, input.task_id, version, 'pending', redactCodexText(input.summary.trim()), JSON.stringify(input.milestones || []), JSON.stringify(input.acceptance || []), JSON.stringify(input.dependencies || []), at, null, null);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.planDetail(plan_id)!;
  }
  planDetail(planId: string): Record<string, any> | undefined { const plan = this.db.prepare('SELECT * FROM plan_proposals WHERE plan_id = ?').get(planId) as Record<string, unknown> | undefined; return plan ? { ...plan, milestones: JSON.parse(String(plan.milestones_json)), acceptance: JSON.parse(String(plan.acceptance_json)), dependencies: JSON.parse(String(plan.dependencies_json)) } : undefined; }
  listPlansForTask(taskId: string) { return (this.db.prepare('SELECT plan_id FROM plan_proposals WHERE task_id = ? ORDER BY version DESC').all(taskId) as Array<{ plan_id: string }>).map(({ plan_id }) => this.planDetail(plan_id)!); }
  approvePlan(planId: string, approvedBy: string) { const plan = this.planDetail(planId); if (!plan) throw new ServiceError('NOT_FOUND', 'Plan not found', {}, 404); if (plan.status !== 'pending') throw new ServiceError('PLAN_NOT_APPROVABLE', 'Only the current pending plan can be approved.', { status: plan.status }, 409); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare(`UPDATE plan_proposals SET status = 'superseded' WHERE task_id = ? AND plan_id != ? AND status = 'approved'`).run(plan.task_id, planId); this.db.prepare(`UPDATE plan_proposals SET status = 'approved', approved_at = ?, approved_by = ? WHERE plan_id = ?`).run(now(), approvedBy.trim() || 'local user', planId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.planDetail(planId)!; }
  approvedPlanForTask(taskId: string) { return this.db.prepare(`SELECT plan_id FROM plan_proposals WHERE task_id = ? AND status = 'approved' ORDER BY approved_at DESC LIMIT 1`).get(taskId) as { plan_id: string } | undefined; }
  guidanceForTask(projectId: string, taskId: string) { return this.db.prepare(`SELECT * FROM guidance_records WHERE project_id = ? AND state = 'active' AND (scope = 'project' OR task_id = ?) ORDER BY CASE scope WHEN 'task' THEN 0 ELSE 1 END, created_at DESC`).all(projectId, taskId); }
  addGuidance(input: { project_id: string; task_id?: string; content: string; provenance: string; replaces_guidance_id?: string }) { if (!this.getProject(input.project_id)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); if (!input.content.trim() || !input.provenance.trim()) throw new ServiceError('VALIDATION_ERROR', 'Guidance needs content and provenance'); if (input.task_id) { const task = this.taskDetail(input.task_id) as { project_id: string } | undefined; if (!task || task.project_id !== input.project_id) throw new ServiceError('INVALID_GUIDANCE_SCOPE', 'Task guidance must belong to this project', {}, 409); } const guidance_id = id('guide'), at = now(); this.db.exec('BEGIN IMMEDIATE'); try { if (input.replaces_guidance_id) this.db.prepare(`UPDATE guidance_records SET state = 'corrected', retired_at = ? WHERE guidance_id = ? AND project_id = ?`).run(at, input.replaces_guidance_id, input.project_id); this.db.prepare('INSERT INTO guidance_records (guidance_id, project_id, scope, task_id, content, provenance, state, replaces_guidance_id, created_at, retired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(guidance_id, input.project_id, input.task_id ? 'task' : 'project', input.task_id || null, redactCodexText(input.content.trim()), input.provenance.trim(), 'active', input.replaces_guidance_id || null, at, null); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.db.prepare('SELECT * FROM guidance_records WHERE guidance_id = ?').get(guidance_id); }
  retireGuidance(guidanceId: string) { const result = this.db.prepare(`UPDATE guidance_records SET state = 'retired', retired_at = ? WHERE guidance_id = ? AND state = 'active'`).run(now(), guidanceId); if (!result.changes) throw new ServiceError('NOT_FOUND', 'Active guidance not found', {}, 404); return this.db.prepare('SELECT * FROM guidance_records WHERE guidance_id = ?').get(guidanceId); }
  createRealRequest(input: { project_id: string; employee_id: string; task_id: string; kind: string; summary: string; detail: string; blocks: string; message_id?: string }) { const request_id = id('req'), at = now(); this.db.prepare('INSERT INTO inbox_requests (request_id, project_id, employee_id, task_id, kind, summary, detail, blocks, source, status, created_at, resolved_at, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(request_id, input.project_id, input.employee_id, input.task_id, input.kind, input.summary, redactCodexText(input.detail), input.blocks, 'codex', 'pending', at, null, input.message_id || null); return this.listInbox().find((request: any) => request.request_id === request_id); }
  createAgentRequest(attemptId: string, text: string, providerItemId?: string) {
    const match = text.match(/\[PIXEL_REQUEST\]\s*(clarification|approval|revision)\s*\|\s*([^|\n]{3,180})\s*\|\s*([^\n]{3,500})/i);
    if (!match) return undefined;
    const attempt = this.executionDetail(attemptId);
    const detail = redactCodexText(text).slice(0, 4000);
    const seen = this.db.prepare(`SELECT request_id FROM inbox_requests WHERE task_id = ? AND source = 'codex' AND detail = ? LIMIT 1`).get(attempt.task_id, detail);
    if (seen) return undefined;
    return this.createRealRequest({ project_id: String((this.taskDetail(String(attempt.task_id)) as any).project_id), employee_id: String(attempt.employee_id), task_id: String(attempt.task_id), kind: match[1].toLowerCase(), summary: match[2].trim(), blocks: match[3].trim(), detail, message_id: providerItemId });
  }
  answerRequest(requestId: string, response: string) { const request = this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId) as Record<string, unknown> | undefined; if (!request || request.status !== 'pending') throw new ServiceError('NOT_FOUND', 'Pending inbox request not found', {}, 404); this.db.prepare(`UPDATE inbox_requests SET status = 'resolved', resolved_at = ?, response_text = ? WHERE request_id = ?`).run(now(), redactCodexText(response.trim()), requestId); return this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId); }
}
