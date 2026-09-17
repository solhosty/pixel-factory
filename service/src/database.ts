import { capacityPolicy, localMeasurement, type Measurement } from './capacity.js';
import { DatabaseSync } from 'node:sqlite';
import { redactCodexText } from './redaction.js';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ServiceError } from './types.js';

export type SqlValue = string | number | null;
export interface ProjectRow { project_id: string; name: string; status: 'active' | 'archived'; execution_state: 'active' | 'paused'; pause_reason: string | null; created_at: string; archived_at: string | null; }
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
, { id: '007_recovery_v1', classification: 'forward-only', sql: `
 ALTER TABLE projects ADD COLUMN execution_state TEXT NOT NULL DEFAULT 'active' CHECK(execution_state IN ('active','paused'));
 ALTER TABLE projects ADD COLUMN pause_reason TEXT;
 ALTER TABLE attempts ADD COLUMN workspace_fingerprint TEXT;
 ALTER TABLE worker_leases ADD COLUMN owner_token TEXT;
 CREATE TABLE continuation_records (
   continuation_id TEXT PRIMARY KEY,
   session_id TEXT NOT NULL REFERENCES sessions(session_id),
   source_attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
   reason TEXT NOT NULL,
   state TEXT NOT NULL CHECK(state IN ('eligible','blocked','resumed','cancelled')),
   provider_thread_id TEXT,
   workspace_set_json TEXT NOT NULL,
   workspace_fingerprint TEXT NOT NULL,
   summary TEXT NOT NULL,
   created_at TEXT NOT NULL,
   resumed_attempt_id TEXT REFERENCES attempts(attempt_id),
   reviewed_at TEXT
 );
 CREATE INDEX continuation_state_idx ON continuation_records(state, created_at);
 CREATE TABLE office_runtime (
   runtime_id TEXT PRIMARY KEY,
   state TEXT NOT NULL CHECK(state IN ('open','closing','closed')),
   last_client_at TEXT,
   updated_at TEXT NOT NULL
 );
 INSERT INTO office_runtime VALUES ('local-office','closed',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 CREATE TABLE office_clients (client_id TEXT PRIMARY KEY, connected_at TEXT NOT NULL, heartbeat_at TEXT NOT NULL);
 ` }
, { id: '008_decision_meetings_v1', classification: 'forward-only', sql: `
 CREATE TABLE decision_meetings (
   decision_id TEXT PRIMARY KEY,
   project_id TEXT NOT NULL REFERENCES projects(project_id),
   employee_id TEXT REFERENCES employees(employee_id),
   kind TEXT NOT NULL CHECK(kind IN ('ui','technical')),
   title TEXT NOT NULL,
   status TEXT NOT NULL CHECK(status IN ('pending','approved')),
   current_version INTEGER NOT NULL,
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL
 );
 CREATE TABLE decision_versions (
   decision_id TEXT NOT NULL REFERENCES decision_meetings(decision_id),
   version INTEGER NOT NULL,
   recommendation TEXT NOT NULL,
   options_json TEXT NOT NULL,
   feedback TEXT,
   affected_task_ids_json TEXT NOT NULL,
   gated_task_ids_json TEXT NOT NULL,
   status TEXT NOT NULL CHECK(status IN ('current','approved','superseded')),
   proposed_at TEXT NOT NULL,
   approved_at TEXT,
   approved_by TEXT,
   PRIMARY KEY(decision_id, version)
 );
 CREATE INDEX decision_meetings_project_idx ON decision_meetings(project_id, status, updated_at DESC);
 ALTER TABLE inbox_requests ADD COLUMN decision_id TEXT REFERENCES decision_meetings(decision_id);
 ALTER TABLE inbox_requests ADD COLUMN decision_version INTEGER;
 ` }
, { id: '009_employee_profiles_v1', classification: 'forward-only', sql: `
 CREATE TABLE positions (
   position_id TEXT PRIMARY KEY,
   name TEXT NOT NULL UNIQUE,
   sort_order INTEGER NOT NULL UNIQUE
 );
 CREATE TABLE skills (
   skill_id TEXT PRIMARY KEY,
   name TEXT NOT NULL,
   instructions TEXT NOT NULL,
   kind TEXT NOT NULL CHECK(kind IN ('built-in','custom')),
   created_at TEXT NOT NULL
 );
 CREATE TABLE position_default_skills (
   position_id TEXT NOT NULL REFERENCES positions(position_id),
   skill_id TEXT NOT NULL REFERENCES skills(skill_id),
   PRIMARY KEY(position_id, skill_id)
 );
 CREATE TABLE employee_skills (
   employee_id TEXT NOT NULL REFERENCES employees(employee_id),
   skill_id TEXT NOT NULL REFERENCES skills(skill_id),
   enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
   selected_at TEXT NOT NULL,
   PRIMARY KEY(employee_id, skill_id)
 );
 ALTER TABLE employees ADD COLUMN position_id TEXT REFERENCES positions(position_id);
 ALTER TABLE employees ADD COLUMN character_id TEXT;
 ALTER TABLE sessions ADD COLUMN resolved_context_json TEXT NOT NULL DEFAULT '{}';

 INSERT INTO positions VALUES
   ('designer','Designer',1),
   ('frontend-engineer','Frontend Engineer',2),
   ('backend-engineer','Backend Engineer',3),
   ('fullstack-engineer','Fullstack Engineer',4),
   ('project-manager','Project Manager',5),
   ('marketing','Marketing',6);
 INSERT INTO skills VALUES
   ('interface-design','Interface design','Design clear interaction states and polished interface systems.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('visual-qa','Visual QA','Inspect responsive, theme, motion, and populated product states.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('frontend-implementation','Frontend implementation','Implement accessible browser interfaces in the project stack.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('browser-verification','Browser verification','Verify behavior through the served application.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('service-design','Service design','Implement bounded local service and API behavior.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('data-modeling','Data modeling','Design durable migrations, invariants, and persistence tests.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('fullstack-delivery','Fullstack delivery','Coordinate UI, service, persistence, and verification as one change.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('delivery-planning','Delivery planning','Sequence bounded work, dependencies, acceptance, and handoff.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('project-coordination','Project coordination','Track decisions, blockers, ownership, and verified outcomes.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('product-messaging','Product messaging','Write specific, evidence-grounded product communication.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('launch-research','Launch research','Research audiences, channels, alternatives, and launch evidence.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO position_default_skills VALUES
   ('designer','interface-design'),('designer','visual-qa'),
   ('frontend-engineer','frontend-implementation'),('frontend-engineer','browser-verification'),
   ('backend-engineer','service-design'),('backend-engineer','data-modeling'),
   ('fullstack-engineer','fullstack-delivery'),('fullstack-engineer','browser-verification'),
   ('project-manager','delivery-planning'),('project-manager','project-coordination'),
   ('marketing','product-messaging'),('marketing','launch-research');
 UPDATE employees SET position_id = CASE
   WHEN lower(title) LIKE '%front%' THEN 'frontend-engineer'
   WHEN lower(title) LIKE '%back%' THEN 'backend-engineer'
   WHEN lower(title) LIKE '%design%' THEN 'designer'
   WHEN lower(title) LIKE '%project%' THEN 'project-manager'
   WHEN lower(title) LIKE '%market%' THEN 'marketing'
   ELSE 'fullstack-engineer' END;
 UPDATE employees SET character_id = 'studio-character-01' WHERE employee_id = (SELECT employee_id FROM employees WHERE active = 1 ORDER BY created_at LIMIT 1);
 UPDATE employees SET character_id = 'studio-character-02' WHERE employee_id = (SELECT employee_id FROM employees WHERE active = 1 ORDER BY created_at LIMIT 1 OFFSET 1);
 UPDATE employees SET character_id = 'studio-character-03' WHERE employee_id = (SELECT employee_id FROM employees WHERE active = 1 ORDER BY created_at LIMIT 1 OFFSET 2);
 CREATE UNIQUE INDEX active_character_owner ON employees(character_id) WHERE active = 1 AND character_id IS NOT NULL;
 ` }
, { id: '010_security_engineer_position_v1', classification: 'forward-only', sql: `
 UPDATE positions SET sort_order = sort_order + 10 WHERE position_id IN ('project-manager','marketing');
 INSERT INTO positions VALUES ('security-engineer','Security Engineer',5);
 UPDATE positions SET sort_order = 6 WHERE position_id = 'project-manager';
 UPDATE positions SET sort_order = 7 WHERE position_id = 'marketing';
 INSERT INTO skills VALUES
   ('threat-modeling','Threat modeling','Identify trust boundaries, abuse cases, and proportionate mitigations before implementation.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   ('security-verification','Security verification','Review security-sensitive changes and verify controls with focused, reproducible checks.','built-in',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO position_default_skills VALUES
   ('security-engineer','threat-modeling'),
   ('security-engineer','security-verification');
 ` }
, { id: '011_rich_task_composition_v1', classification: 'forward-only', sql: `
 ALTER TABLE tasks ADD COLUMN brief_text TEXT NOT NULL DEFAULT '';
 ALTER TABLE tasks ADD COLUMN task_instructions TEXT NOT NULL DEFAULT '';
 CREATE TABLE task_inputs (
   input_id TEXT PRIMARY KEY,
   task_id TEXT NOT NULL REFERENCES tasks(task_id),
   kind TEXT NOT NULL CHECK(kind IN ('paste','image','file','file-reference','project','employee','task')),
   label TEXT NOT NULL,
   mime_type TEXT,
   content_base64 TEXT,
   source_path TEXT,
   referenced_id TEXT,
   provenance TEXT NOT NULL,
   position INTEGER NOT NULL,
   availability TEXT NOT NULL CHECK(availability IN ('available','unavailable')),
   unavailable_reason TEXT,
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL,
   UNIQUE(task_id, position)
 );
 CREATE INDEX task_inputs_task_idx ON task_inputs(task_id, position);
 ` }
, { id: '012_demo_verification_v1', classification: 'forward-only', sql: `
 CREATE TABLE demo_recipes (
   recipe_id TEXT PRIMARY KEY,
   task_id TEXT NOT NULL UNIQUE REFERENCES tasks(task_id),
   setup_commands_json TEXT NOT NULL,
   start_command TEXT NOT NULL,
   readiness_command TEXT NOT NULL,
   ports_json TEXT NOT NULL,
   cleanup_command TEXT NOT NULL,
   known_gaps TEXT NOT NULL,
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL
 );
 CREATE TABLE demo_evidence (
   evidence_id TEXT PRIMARY KEY,
   recipe_id TEXT NOT NULL REFERENCES demo_recipes(recipe_id),
   fingerprints_json TEXT NOT NULL,
   checks_json TEXT NOT NULL,
   preview_note TEXT NOT NULL,
   status TEXT NOT NULL CHECK(status IN ('fresh','stale','accepted','failed')),
   created_at TEXT NOT NULL,
   accepted_at TEXT,
   accepted_by TEXT,
   stale_reason TEXT
 );
 CREATE INDEX demo_evidence_recipe_idx ON demo_evidence(recipe_id, created_at DESC);
 ` }
, { id: '013_delivery_rehearsal_v1', classification: 'forward-only', sql: `
 CREATE TABLE task_delivery_overrides (
   task_id TEXT PRIMARY KEY REFERENCES tasks(task_id),
   delivery_mode TEXT NOT NULL CHECK(delivery_mode IN ('local','branch','pull_request','merge')),
   destination TEXT NOT NULL DEFAULT '',
   updated_at TEXT NOT NULL
 );
 CREATE TABLE delivery_attempts (
   delivery_attempt_id TEXT PRIMARY KEY,
   task_id TEXT NOT NULL REFERENCES tasks(task_id),
   project_id TEXT NOT NULL REFERENCES projects(project_id),
   mode TEXT NOT NULL CHECK(mode IN ('local','branch','pull_request','merge')),
   status TEXT NOT NULL CHECK(status IN ('pending','partial','delivered','failed')),
   requested_at TEXT NOT NULL,
   completed_at TEXT,
   UNIQUE(task_id, requested_at)
 );
 CREATE TABLE delivery_outcomes (
   delivery_attempt_id TEXT NOT NULL REFERENCES delivery_attempts(delivery_attempt_id),
   folder_id TEXT NOT NULL REFERENCES local_folders(folder_id),
   status TEXT NOT NULL CHECK(status IN ('pending','delivered','failed')),
   destination TEXT NOT NULL DEFAULT '',
   detail TEXT NOT NULL DEFAULT '',
   updated_at TEXT NOT NULL,
   PRIMARY KEY(delivery_attempt_id, folder_id)
 );
 CREATE TABLE project_release_states (
   project_id TEXT PRIMARY KEY REFERENCES projects(project_id),
   state TEXT NOT NULL CHECK(state IN ('active','delivered','done')),
   updated_at TEXT NOT NULL,
   done_at TEXT
 );
 INSERT INTO project_release_states SELECT project_id, 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL FROM projects;
 ` }
, { id: '014_delivery_git_execution_v1', classification: 'forward-only', sql: `
 ALTER TABLE delivery_outcomes ADD COLUMN baseline_json TEXT NOT NULL DEFAULT '{}';
 ` }
, { id: '015_optional_workplace_skills_v1', classification: 'forward-only', sql: `
 DELETE FROM position_default_skills;
 CREATE TABLE workplace_skills (skill_id TEXT PRIMARY KEY REFERENCES skills(skill_id), source_url TEXT, added_at TEXT NOT NULL);
 ` }
, { id: '016_pre_execution_delivery_baselines_v1', classification: 'forward-only', sql: `
 CREATE TABLE task_delivery_baselines (
   task_id TEXT NOT NULL REFERENCES tasks(task_id),
   folder_id TEXT NOT NULL REFERENCES local_folders(folder_id),
   baseline_json TEXT NOT NULL,
   captured_at TEXT NOT NULL,
   PRIMARY KEY(task_id, folder_id)
 );
 ` }
, { id: '017_conversational_task_threads_v1', classification: 'forward-only', sql: `
 CREATE TABLE task_thread_entries (
   entry_id TEXT PRIMARY KEY,
   task_id TEXT NOT NULL REFERENCES tasks(task_id),
   author TEXT NOT NULL CHECK(author IN ('user','coworker','system')),
   kind TEXT NOT NULL CHECK(kind IN ('objective','message','context','state')),
   body TEXT NOT NULL,
   source_ref TEXT,
   created_at TEXT NOT NULL
 );
 CREATE INDEX task_thread_entries_task_idx ON task_thread_entries(task_id, created_at);
 CREATE UNIQUE INDEX task_thread_entries_source_idx ON task_thread_entries(task_id, source_ref) WHERE source_ref IS NOT NULL;
 ` }
] as const;

const now = () => new Date().toISOString();
const id = (kind: string) => `${kind}_${randomUUID()}`;
const fingerprintWorkspace = (roots: string[]) => {
  const hash = createHash('sha256');
  const walk = (root: string, relative = '') => {
    const absolute = relative ? `${root}/${relative}` : root;
    let entries: string[];
    try { entries = readdirSync(absolute).sort(); } catch { hash.update(`missing:${root}:${relative}\n`); return; }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.svelte-kit' || name === 'build') continue;
      const child = relative ? `${relative}/${name}` : name;
      try { const stat = statSync(`${root}/${child}`); hash.update(`${root}:${child}:${stat.isDirectory() ? 'd' : 'f'}:${stat.size}:${Math.trunc(stat.mtimeMs)}\n`); if (stat.isDirectory()) walk(root, child); } catch { hash.update(`unreadable:${root}:${child}\n`); }
    }
  };
  for (const root of [...roots].sort()) walk(root);
  return hash.digest('hex');
};
const gitBaseline = (path: string) => {
  try {
    const run=(args:string[])=>execFileSync('git',['-C',path,...args],{encoding:'utf8',timeout:2000,stdio:['ignore','pipe','pipe']}).trim();
    return { repository:true, head:run(['rev-parse','HEAD']), branch:run(['branch','--show-current']), status:run(['status','--porcelain=v1']) };
  } catch { return { repository:false, head:null, branch:null, status:null }; }
};
export const CHARACTER_IDS = Array.from({ length: 6 }, (_, index) => `studio-character-${String(index + 1).padStart(2, '0')}`);
const POSITION_IDS = ['designer','frontend-engineer','backend-engineer','fullstack-engineer','security-engineer','project-manager','marketing'] as const;
const CHARACTER_RECIPES: Record<string, Record<string,string>> = {
  'studio-character-01': { body:'base-01',skin:'sienna-01',hair:'short-auburn-03',top:'cardigan-navy-01',bottom:'trousers-charcoal-01',accent:'indigo-01',accessory:'glasses-round-01' },
  'studio-character-02': { body:'base-01',skin:'umber-02',hair:'short-auburn-03',top:'cardigan-navy-01',bottom:'trousers-charcoal-01',accent:'terracotta-01',accessory:'glasses-round-01' },
  'studio-character-03': { body:'identity-03',skin:'medium-brown-03',hair:'wavy-dark-03',top:'overshirt-ochre-03',bottom:'trousers-charcoal-01',accent:'ochre-03',accessory:'none' },
  'studio-character-04': { body:'identity-04',skin:'olive-04',hair:'pixie-silver-04',top:'vest-moss-04',bottom:'trousers-charcoal-04',accent:'cream-04',accessory:'square-glasses-04' },
  'studio-character-05': { body:'identity-05',skin:'deep-brown-05',hair:'natural-curls-05',top:'cardigan-clay-05',bottom:'trousers-navy-05',accent:'cream-05',accessory:'none' },
  'studio-character-06': { body:'identity-06',skin:'warm-medium-06',hair:'side-part-ink-06',top:'sweater-navy-06',bottom:'trousers-charcoal-06',accent:'collar-rust-06',accessory:'none' }
};
const recipeFor = (characterId: string) => JSON.stringify(CHARACTER_RECIPES[characterId] || CHARACTER_RECIPES['studio-character-01']);

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
    try { this.db.prepare('INSERT INTO projects (project_id, name, status, created_at, archived_at) VALUES (?, ?, ?, ?, ?)').run(project_id, name.trim(), 'active', at, null); this.db.prepare('INSERT INTO project_delivery_settings VALUES (?, ?, ?, ?, ?)').run(project_id, null, 'review', '', at); this.db.prepare('INSERT INTO project_release_states VALUES (?, ?, ?, ?)').run(project_id, 'active', at, null); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getProject(project_id)!;
  }
  getProject(projectId: string) { return this.db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId) as unknown as ProjectRow | undefined; }
  listProjects() { return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as unknown as ProjectRow[]; }
  setProjectStatus(projectId: string, status: 'active' | 'archived') {
    if (!this.getProject(projectId)) throw new ServiceError('NOT_FOUND', 'Project not found', { project_id: projectId }, 404);
    if (status === 'archived' && this.releaseState(projectId).state !== 'done') throw new ServiceError('PROJECT_COMPLETION_REQUIRED', 'Mark the project done after its selected deliveries before archiving.', {}, 409);
    const at = now(); this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE projects SET status = ?, archived_at = ? WHERE project_id = ?').run(status, status === 'archived' ? at : null, projectId);
      if (status === 'archived') this.db.prepare(`UPDATE assignments SET ended_at = ? WHERE ended_at IS NULL AND task_id IN (SELECT task_id FROM tasks WHERE project_id = ?)` ).run(at, projectId);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getProject(projectId)!;
  }
  delivery(projectId: string) { return this.db.prepare('SELECT * FROM project_delivery_settings WHERE project_id = ?').get(projectId); }
  releaseState(projectId:string) { return this.db.prepare('SELECT * FROM project_release_states WHERE project_id=?').get(projectId) as any; }
  updateDelivery(projectId: string, values: { default_branch?: string | null; delivery_mode?: string; notes?: string }) { if (!this.getProject(projectId)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); const old = this.delivery(projectId) as Record<string, SqlValue>; const mode=String(values.delivery_mode ?? old.delivery_mode); if(!['local','branch','pull_request','merge','review'].includes(mode))throw new ServiceError('VALIDATION_ERROR','Choose local, branch, pull request, merge, or review delivery.'); this.db.prepare('UPDATE project_delivery_settings SET default_branch = ?, delivery_mode = ?, notes = ?, updated_at = ? WHERE project_id = ?').run(values.default_branch ?? old.default_branch, mode, values.notes ?? old.notes, now(), projectId); return this.delivery(projectId); }
  taskDelivery(taskId:string){return this.db.prepare('SELECT * FROM task_delivery_overrides WHERE task_id=?').get(taskId) as any;}
  setTaskDelivery(taskId:string,input:{delivery_mode:string;destination?:string}){const task=this.taskDetail(taskId);if(!task)throw new ServiceError('NOT_FOUND','Task not found',{},404);if(!['local','branch','pull_request','merge'].includes(input.delivery_mode))throw new ServiceError('VALIDATION_ERROR','Unsupported task delivery mode.');this.db.prepare('INSERT INTO task_delivery_overrides VALUES (?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET delivery_mode=excluded.delivery_mode,destination=excluded.destination,updated_at=excluded.updated_at').run(taskId,input.delivery_mode,redactCodexText(String(input.destination||'')),now());return this.taskDelivery(taskId);}
  private deliveryAttemptDetail(attemptId:string){const attempt=this.db.prepare('SELECT * FROM delivery_attempts WHERE delivery_attempt_id=?').get(attemptId) as any;if(!attempt)return undefined;return {...attempt,outcomes:this.db.prepare('SELECT * FROM delivery_outcomes WHERE delivery_attempt_id=? ORDER BY rowid').all(attemptId)};}
  deliveryForTask(taskId:string){const rows=this.db.prepare('SELECT delivery_attempt_id FROM delivery_attempts WHERE task_id=? ORDER BY requested_at DESC').all(taskId) as any[];return {override:this.taskDelivery(taskId),attempts:rows.map(row=>this.deliveryAttemptDetail(row.delivery_attempt_id))};}
  private captureTaskDeliveryBaselines(task:any){for(const folder of task.folders as any[])this.db.prepare('INSERT OR IGNORE INTO task_delivery_baselines VALUES (?,?,?,?)').run(task.task_id,folder.folder_id,JSON.stringify(gitBaseline(folder.canonical_path)),now());}
  beginDelivery(taskId:string){const task=this.taskDetail(taskId);if(!task)throw new ServiceError('NOT_FOUND','Task not found',{},404);if(!task.demo?.evidence?.some((item:any)=>item.status==='accepted'))throw new ServiceError('DEMO_ACCEPTANCE_REQUIRED','Accept current demo evidence before recording delivery.',{},409);const delivery=this.taskDelivery(taskId)||this.delivery(String(task.project_id));const mode=String(delivery?.delivery_mode||'review');if(!['local','branch','pull_request','merge'].includes(mode))throw new ServiceError('DELIVERY_CONFIGURATION_REQUIRED','Set a local, branch, PR, or merge delivery mode first.',{},409);const unfinished=(this.deliveryForTask(taskId).attempts as any[]).find((item:any)=>['pending','partial','failed'].includes(item.status));const at=now(),attemptId=unfinished?.delivery_attempt_id||id('delivery');this.db.exec('BEGIN IMMEDIATE');try{if(!unfinished){this.db.prepare('INSERT INTO delivery_attempts VALUES (?,?,?,?,?,?,?)').run(attemptId,taskId,task.project_id,mode,'pending',at,null);for(const folder of task.folders){const captured=this.db.prepare('SELECT baseline_json FROM task_delivery_baselines WHERE task_id=? AND folder_id=?').get(taskId,folder.folder_id) as any;this.db.prepare('INSERT INTO delivery_outcomes (delivery_attempt_id,folder_id,status,destination,detail,updated_at,baseline_json) VALUES (?,?,?,?,?,?,?)').run(attemptId,folder.folder_id,'pending','', '',at,captured?.baseline_json||JSON.stringify(gitBaseline(folder.canonical_path)));}}this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return this.deliveryAttemptDetail(attemptId)!;}
  recordDeliveryOutcome(taskId:string,input:{delivery_attempt_id:string;folder_id:string;status:string;destination?:string;detail?:string}){const task=this.taskDetail(taskId);const attempt=this.deliveryAttemptDetail(input.delivery_attempt_id);if(!task||!attempt||attempt.task_id!==taskId)throw new ServiceError('NOT_FOUND','Delivery attempt not found',{},404);if(!['delivered','failed'].includes(input.status))throw new ServiceError('VALIDATION_ERROR','Outcome must be delivered or failed.');if(!task.folders.some((folder:any)=>folder.folder_id===input.folder_id))throw new ServiceError('INVALID_DELIVERY_FOLDER','The folder is not selected for this task.',{},409);const at=now();this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('UPDATE delivery_outcomes SET status=?,destination=?,detail=?,updated_at=? WHERE delivery_attempt_id=? AND folder_id=?').run(input.status,redactCodexText(String(input.destination||'')),redactCodexText(String(input.detail||'')),at,input.delivery_attempt_id,input.folder_id);const states=this.db.prepare('SELECT status FROM delivery_outcomes WHERE delivery_attempt_id=?').all(input.delivery_attempt_id) as any[];const status=states.every(item=>item.status==='delivered')?'delivered':states.some(item=>item.status==='delivered')?'partial':states.some(item=>item.status==='failed')?'failed':'pending';this.db.prepare('UPDATE delivery_attempts SET status=?,completed_at=? WHERE delivery_attempt_id=?').run(status,status==='delivered'?at:null,input.delivery_attempt_id);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}if(this.deliveryAttemptDetail(input.delivery_attempt_id)!.status==='delivered')this.db.prepare("UPDATE project_release_states SET state='delivered',updated_at=? WHERE project_id=? AND state='active'").run(at,task.project_id);return this.deliveryAttemptDetail(input.delivery_attempt_id)!;}
  markProjectDone(projectId:string){const project=this.projectDetail(projectId);if(!project)throw new ServiceError('NOT_FOUND','Project not found',{},404);const selected=project.tasks.filter((task:any)=>task.delivery?.override||this.delivery(projectId)?.delivery_mode!=='review');if(selected.some((task:any)=>!task.delivery.attempts.some((attempt:any)=>attempt.status==='delivered')))throw new ServiceError('PROJECT_DELIVERY_INCOMPLETE','Every selected delivery must be recorded before marking the project done.',{},409);const at=now();this.db.prepare("UPDATE project_release_states SET state='done',updated_at=?,done_at=? WHERE project_id=?").run(at,at,projectId);return this.releaseState(projectId);}
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
  staffCatalog() {
    const owned = new Map((this.db.prepare('SELECT character_id, employee_id FROM employees WHERE active = 1 AND character_id IS NOT NULL').all() as Array<{character_id:string;employee_id:string}>).map(row => [row.character_id,row.employee_id]));
    return {
      positions: this.db.prepare('SELECT * FROM positions ORDER BY sort_order').all().map((position:any)=>({ ...position, default_skills:[] })),
      skills: this.db.prepare('SELECT s.*, w.source_url FROM skills s JOIN workplace_skills w USING(skill_id) ORDER BY s.name').all(),
      characters: CHARACTER_IDS.map(character_id=>({ character_id, owner_employee_id:owned.get(character_id)||null, ready:true, appearance_recipe:CHARACTER_RECIPES[character_id] }))
    };
  }
  private availableCharacter(characterId?: string) {
    if(characterId&&!CHARACTER_IDS.includes(characterId)) throw new ServiceError('CHARACTER_IDENTITY_UNAVAILABLE','Choose one of the complete predefined character identities.',{character_id:characterId},409);
    const requested=characterId||CHARACTER_IDS.find(candidate=>!this.db.prepare('SELECT 1 FROM employees WHERE active=1 AND character_id=?').get(candidate));
    if(!requested) throw new ServiceError('STUDIO_CAPACITY_REACHED','The initial roster has no unused complete character identity.',{active_roster_capacity:CHARACTER_IDS.length,studio_desks:8},409);
    if(this.db.prepare('SELECT 1 FROM employees WHERE active=1 AND character_id=?').get(requested)) throw new ServiceError('CHARACTER_IDENTITY_IN_USE','Choose an unused predefined character identity.',{character_id:requested},409);
    return requested;
  }
  createEmployee(input: { name: string; position_id?: string; character_id?: string; title?: string; color?: string }) {
    if (!input.name.trim()) throw new ServiceError('VALIDATION_ERROR', 'Staff name is required');
    const positionId=input.position_id||'fullstack-engineer'; if(!POSITION_IDS.includes(positionId as any)) throw new ServiceError('VALIDATION_ERROR','Choose one of the seven employee positions.');
    const characterId=this.availableCharacter(input.character_id), position=this.db.prepare('SELECT name FROM positions WHERE position_id=?').get(positionId) as {name:string}, employee_id=id('emp'), at=now();
    this.db.prepare('INSERT INTO employees (employee_id,name,title,color,active,created_at,updated_at,appearance_recipe,position_id,character_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(employee_id,input.name.trim(),position.name,input.color||'#587d61',1,at,at,recipeFor(characterId),positionId,characterId);
    return this.employeeDetail(employee_id)!;
  }
  getEmployee(employeeId: string) { return this.db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employeeId); }
  employeeDetail(employeeId: string): Record<string, any> | undefined {
    const employee = this.getEmployee(employeeId) as Record<string, unknown> | undefined; if (!employee) return undefined;
    const active_assignments = this.db.prepare(`SELECT a.*, t.title AS task_title, t.project_id, p.name AS project_name FROM assignments a JOIN tasks t ON t.task_id = a.task_id JOIN projects p ON p.project_id = t.project_id WHERE a.employee_id = ? AND a.ended_at IS NULL ORDER BY a.assigned_at DESC`).all(employeeId);
    // `assignment` remains a compatibility alias; task ownership is plural in 3G.
    const assignment = active_assignments[0];
    const history = this.db.prepare(`SELECT a.*, t.title AS task_title, p.name AS project_name FROM assignments a JOIN tasks t ON t.task_id = a.task_id JOIN projects p ON p.project_id = t.project_id WHERE a.employee_id = ? ORDER BY a.assigned_at DESC`).all(employeeId);
    const skills=this.db.prepare('SELECT s.*, es.enabled FROM employee_skills es JOIN skills s USING(skill_id) WHERE es.employee_id=? ORDER BY s.name').all(employeeId);
    return { ...employee, environment: this.employeeEnvironment(employeeId), appearance_recipe: JSON.parse(String(employee.appearance_recipe || '{}')), skills, assignment, active_assignments, history };
  }
  listEmployees() { return (this.db.prepare('SELECT employee_id FROM employees ORDER BY created_at').all() as Array<{ employee_id: string }>).map(({ employee_id }) => this.employeeDetail(employee_id)); }
  updateEmployee(employeeId: string, input: { name?: string; position_id?: string; character_id?: string; color?: string; active?: boolean }) {
    const old = this.getEmployee(employeeId) as Record<string, SqlValue> | undefined; if (!old) throw new ServiceError('NOT_FOUND', 'Staff member not found', {}, 404);
    const positionId=input.position_id||String(old.position_id); if(!POSITION_IDS.includes(positionId as any)) throw new ServiceError('VALIDATION_ERROR','Choose one of the seven employee positions.');
    const characterId=input.character_id&&input.character_id!==old.character_id?this.availableCharacter(input.character_id):String(old.character_id);
    const position=this.db.prepare('SELECT name FROM positions WHERE position_id=?').get(positionId) as {name:string};
    this.db.prepare('UPDATE employees SET name=?,title=?,color=?,active=?,position_id=?,character_id=?,appearance_recipe=?,updated_at=? WHERE employee_id=?').run(input.name?.trim()||old.name,position.name,input.color||old.color,input.active===undefined?old.active:Number(input.active),positionId,characterId,recipeFor(characterId),now(),employeeId);
    return this.employeeDetail(employeeId);
  }
  updateAppearance(_employeeId?:string,_recipe?:Record<string,string>):never { throw new ServiceError('PREDEFINED_CHARACTER_REQUIRED','Character appearance is fixed; choose an unused predefined identity instead.',{},409); }
  addEmployeeSkill(employeeId:string,input:{skill_id?:string;name?:string;instructions?:string;enabled?:boolean}) {
    if(!this.getEmployee(employeeId)) throw new ServiceError('NOT_FOUND','Staff member not found',{},404);
    let skillId=String(input.skill_id||'');
    if(!skillId){if(!input.name?.trim()||!input.instructions?.trim()) throw new ServiceError('VALIDATION_ERROR','A custom skill needs a name and reusable instructions.');skillId=id('skill');this.db.prepare('INSERT INTO skills VALUES (?,?,?,?,?)').run(skillId,input.name.trim(),redactCodexText(input.instructions.trim()),'custom',now());}
    if(!this.db.prepare('SELECT 1 FROM skills WHERE skill_id=?').get(skillId)) throw new ServiceError('NOT_FOUND','Skill not found',{},404);
    this.db.prepare('INSERT INTO employee_skills VALUES (?,?,?,?) ON CONFLICT(employee_id,skill_id) DO UPDATE SET enabled=excluded.enabled').run(employeeId,skillId,input.enabled===false?0:1,now());return this.employeeDetail(employeeId);
  }
  setEmployeeSkill(employeeId:string,skillId:string,enabled:boolean){if(!this.db.prepare('SELECT 1 FROM employee_skills WHERE employee_id=? AND skill_id=?').get(employeeId,skillId)) throw new ServiceError('NOT_FOUND','Employee skill not found',{},404);this.db.prepare('UPDATE employee_skills SET enabled=? WHERE employee_id=? AND skill_id=?').run(Number(enabled),employeeId,skillId);return this.employeeDetail(employeeId);}
  resolvedContext(employeeId:string,projectId:string,taskId:string,taskInstructions:string){
    const employee=this.employeeDetail(employeeId);if(!employee)throw new ServiceError('NOT_FOUND','Staff member not found',{},404);
    const defaults=this.db.prepare('SELECT s.skill_id,s.name,s.instructions,s.kind FROM position_default_skills p JOIN skills s USING(skill_id) WHERE p.position_id=? ORDER BY s.name').all(employee.position_id);
    const selected=this.db.prepare('SELECT s.skill_id,s.name,s.instructions,s.kind FROM employee_skills es JOIN skills s USING(skill_id) WHERE es.employee_id=? AND es.enabled=1 ORDER BY s.name').all(employeeId);
    const guidance=this.guidanceForTask(projectId,taskId);
    const task=this.taskDetail(taskId);
    const resolveTagged=(item:any)=>{
      if(item.kind==='project'){const project=this.getProject(item.referenced_id);return project?{type:'project',project_id:project.project_id,name:project.name,status:project.status,delivery:this.delivery(project.project_id)}:null;}
      if(item.kind==='employee'){const person=this.employeeDetail(item.referenced_id);return person?{type:'employee',employee_id:person.employee_id,name:person.name,title:person.title,position_id:person.position_id,active:Boolean(person.active),environment:person.environment?{environment_id:person.environment.environment_id,name:person.environment.name,kind:person.environment.kind}:null}:null;}
      if(item.kind==='task'){const tagged=this.taskDetail(item.referenced_id);return tagged?{type:'task',task_id:tagged.task_id,project_id:tagged.project_id,title:tagged.title,status:tagged.status,folder_ids:tagged.folders.map((folder:any)=>folder.folder_id),employee_id:tagged.assignments[0]?.employee_id||null}:null;}
      return undefined;
    };
    return { version:3, position:{position_id:employee.position_id,name:employee.title}, skills:[...defaults,...selected.filter((skill:any)=>!defaults.some((item:any)=>item.skill_id===skill.skill_id))], project_guidance:guidance, task_brief:redactCodexText(String(task?.brief_text||'')), task_instructions:redactCodexText(String(task?.task_instructions||taskInstructions)), task_inputs:(task?.inputs||[]).map((item:any)=>({input_id:item.input_id,kind:item.kind,label:item.label,mime_type:item.mime_type,referenced_id:item.referenced_id,source_path:item.source_path,provenance:item.provenance,position:item.position,availability:item.availability,unavailable_reason:item.unavailable_reason,resolved_value:resolveTagged(item)})), captured_at:now(), capability_note:'Skills and task inputs are instructions and context only. Filesystem scope, tools, accounts, permissions, and execution environment remain independently enforced.' };
  }
  private validateFolders(projectId:string,folderIds:string[],primaryFolderId:string){const unique=[...new Set(folderIds||[])];if(!unique.length||!unique.includes(primaryFolderId))throw new ServiceError('VALIDATION_ERROR','Select task folders and one primary folder');for(const folderId of unique){const folder=this.db.prepare('SELECT * FROM local_folders WHERE folder_id=?').get(folderId) as unknown as FolderRow|undefined;if(!folder||folder.project_id!==projectId)throw new ServiceError('INVALID_FOLDER_SELECTION','Each task folder must belong to this project',{folder_id:folderId});if(folder.availability!=='available')throw new ServiceError('FOLDER_UNAVAILABLE','Relink unavailable folders before selecting them',{folder_id:folderId});}return unique;}
  private normalizeInputs(inputs:any[]){if(!Array.isArray(inputs)||inputs.length>50)throw new ServiceError('VALIDATION_ERROR','A task can contain up to 50 ordered inputs.');const allowed=new Set(['paste','image','file','file-reference','project','employee','task']);return inputs.map((raw,index)=>{const kind=String(raw.kind||'');if(!allowed.has(kind))throw new ServiceError('VALIDATION_ERROR','Unsupported task input kind.',{kind});const content=raw.content_base64==null?null:String(raw.content_base64);if(content&&content.length>14_000_000)throw new ServiceError('INPUT_TOO_LARGE','Each persisted attachment must be 10 MB or smaller.',{},413);const referenced=raw.referenced_id?String(raw.referenced_id):null;if(kind==='project'&&!this.getProject(referenced||''))throw new ServiceError('INVALID_CONTEXT_REFERENCE','Tagged project no longer exists.',{},409);if(kind==='employee'&&!this.getEmployee(referenced||''))throw new ServiceError('INVALID_CONTEXT_REFERENCE','Tagged employee no longer exists.',{},409);if(kind==='task'&&!this.taskDetail(referenced||''))throw new ServiceError('INVALID_CONTEXT_REFERENCE','Tagged task no longer exists.',{},409);const source=raw.source_path?String(raw.source_path):null;const unavailable=kind==='file-reference'&&(!source||!existsSync(source));return{input_id:String(raw.input_id||id('inp')),kind,label:String(raw.label||kind).trim(),mime:raw.mime_type?String(raw.mime_type):null,content,source,referenced,provenance:String(raw.provenance||'task composer'),position:index,availability:unavailable?'unavailable':'available',reason:unavailable?'Referenced file is missing or inaccessible':null};});}
  private invalidatePlans(taskId:string){this.db.prepare("UPDATE plan_proposals SET status='superseded' WHERE task_id=? AND status IN ('pending','approved')").run(taskId);}
  saveTaskDraft(taskId:string|undefined,input:{project_id?:string;title:string;employee_id?:string;folder_ids:string[];primary_folder_id:string;brief_text?:string;task_instructions?:string;inputs?:any[]}){
    const existing=taskId?this.taskDetail(taskId):undefined;if(taskId&&!existing)throw new ServiceError('NOT_FOUND','Task not found',{},404);const projectId=String(input.project_id||existing?.project_id||'');if(!this.getProject(projectId))throw new ServiceError('NOT_FOUND','Project not found',{},404);const title=String(input.title||'').trim();if(!title)throw new ServiceError('VALIDATION_ERROR','Task title is required');const folders=this.validateFolders(projectId,input.folder_ids,input.primary_folder_id);const rows=this.normalizeInputs(input.inputs||[]);const employeeId=input.employee_id?String(input.employee_id):undefined;if(employeeId&&!this.getEmployee(employeeId))throw new ServiceError('NOT_FOUND','Staff member not found',{},404);const currentEmployee=existing?.assignments?.[0]?.employee_id;
    const resultId=taskId||id('tsk'),at=now();this.db.exec('BEGIN IMMEDIATE');try{if(existing){this.db.prepare('UPDATE tasks SET title=?,brief_text=?,task_instructions=?,updated_at=? WHERE task_id=?').run(title,redactCodexText(String(input.brief_text||'')),redactCodexText(String(input.task_instructions||'')),at,resultId);this.db.prepare('DELETE FROM task_folders WHERE task_id=?').run(resultId);this.db.prepare('DELETE FROM task_inputs WHERE task_id=?').run(resultId);if(currentEmployee!==employeeId){this.db.prepare('UPDATE assignments SET ended_at=? WHERE task_id=? AND ended_at IS NULL').run(at,resultId);if(employeeId)this.db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?)').run(id('asg'),employeeId,resultId,at,null);}this.invalidatePlans(resultId);}else{this.db.prepare('INSERT INTO tasks (task_id,project_id,title,status,created_at,updated_at,brief_text,task_instructions) VALUES (?,?,?,?,?,?,?,?)').run(resultId,projectId,title,'planned',at,at,redactCodexText(String(input.brief_text||'')),redactCodexText(String(input.task_instructions||'')));if(employeeId)this.db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?)').run(id('asg'),employeeId,resultId,at,null);}for(const folderId of folders)this.db.prepare('INSERT INTO task_folders VALUES (?,?,?)').run(resultId,folderId,Number(folderId===input.primary_folder_id));for(const row of rows)this.db.prepare('INSERT INTO task_inputs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(row.input_id,resultId,row.kind,row.label,row.mime,row.content,row.source,row.referenced,row.provenance,row.position,row.availability,row.reason,at,at);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return this.taskDetail(resultId)!;
  }
  createTask(input:{project_id:string;title:string;employee_id?:string;folder_ids:string[];primary_folder_id:string;brief_text?:string;task_instructions?:string;inputs?:any[]}){
    const task=this.saveTaskDraft(undefined,input);
    this.addThreadEntry(task.task_id,'user','objective',String(input.brief_text||input.title),`objective:${task.task_id}`);
    return this.taskDetail(task.task_id)!;
  }
  private addThreadEntry(taskId:string,author:'user'|'coworker'|'system',kind:'objective'|'message'|'context'|'state',body:string,sourceRef?:string){
    const content=redactCodexText(body.trim()); if(!content)return undefined;
    const entryId=id('thread');
    this.db.prepare('INSERT OR IGNORE INTO task_thread_entries VALUES (?,?,?,?,?,?,?)').run(entryId,taskId,author,kind,content,sourceRef||null,now());
    return this.db.prepare('SELECT * FROM task_thread_entries WHERE entry_id=?').get(entryId);
  }
  addTaskThreadMessage(taskId:string,input:{body:string;save_as_team_agreement?:boolean}){
    const task=this.taskDetail(taskId);if(!task)throw new ServiceError('NOT_FOUND','Task not found',{},404);
    const body=String(input.body||'').trim();if(!body)throw new ServiceError('VALIDATION_ERROR','Write a message before sending it.');
    this.db.exec('BEGIN IMMEDIATE');try{
      this.addThreadEntry(taskId,'user','message',body);
      if(input.save_as_team_agreement){const guidanceId=id('guide'),at=now();this.db.prepare('INSERT INTO guidance_records (guidance_id,project_id,scope,task_id,content,provenance,state,replaces_guidance_id,created_at,retired_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(guidanceId,task.project_id,'project',null,redactCodexText(body),`team-agreement:${taskId}`,'active',null,at,null);this.addThreadEntry(taskId,'system','state','Saved to Team agreements for this project.',`guidance:${guidanceId}`);}
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return this.taskThread(taskId)!;
  }
  taskThread(taskId:string):Record<string,any>|undefined{
    const task=this.taskDetail(taskId);if(!task)return undefined;
    const entries=this.db.prepare('SELECT * FROM task_thread_entries WHERE task_id=? ORDER BY created_at, rowid').all(taskId) as any[];
    const requests=this.listInbox().filter((request:any)=>request.task_id===taskId);
    const decisions=this.listDecisions(String(task.project_id)).filter((meeting:any)=>meeting.current?.affected_task_ids?.includes(taskId)||meeting.current?.gated_task_ids?.includes(taskId));
    return {...task,thread:{entries,requests,decisions,team_agreements:this.db.prepare("SELECT * FROM guidance_records WHERE project_id=? AND scope='project' AND provenance LIKE 'team-agreement:%' ORDER BY created_at DESC").all(task.project_id),waiting_on:requests.find((request:any)=>request.status==='pending')?.blocks||decisions.find((meeting:any)=>meeting.status==='pending')?.current?.recommendation||(!this.approvedPlanForTask(taskId)?'Waiting for you to approve a plan.':null)}};
  }
  assignTask(taskId:string,employeeId?:string){
    const task=this.taskDetail(taskId);if(!task)throw new ServiceError('NOT_FOUND','Task not found',{},404);if(task.status==='complete')throw new ServiceError('TASK_COMPLETE','Reopen the task before assigning it.',{},409);
    if(employeeId&&!this.getEmployee(employeeId))throw new ServiceError('NOT_FOUND','Staff member not found',{},404);
    const current=task.assignments[0];if(current?.employee_id===employeeId)return task;
    const at=now();this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('UPDATE assignments SET ended_at=? WHERE task_id=? AND ended_at IS NULL').run(at,taskId);if(employeeId)this.db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?)').run(id('asg'),employeeId,taskId,at,null);this.db.prepare('UPDATE tasks SET updated_at=? WHERE task_id=?').run(at,taskId);this.invalidatePlans(taskId);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return this.taskDetail(taskId)!;
  }
  updateTaskDraft(taskId:string,input:{title?:string;brief_text?:string;task_instructions?:string}){const task=this.taskDetail(taskId);if(!task)throw new ServiceError('NOT_FOUND','Task not found',{},404);const title=input.title===undefined?String(task.title):String(input.title).trim();if(!title)throw new ServiceError('VALIDATION_ERROR','Task title is required');this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('UPDATE tasks SET title=?,brief_text=?,task_instructions=?,updated_at=? WHERE task_id=?').run(title,redactCodexText(input.brief_text===undefined?String(task.brief_text):String(input.brief_text)),redactCodexText(input.task_instructions===undefined?String(task.task_instructions):String(input.task_instructions)),now(),taskId);this.invalidatePlans(taskId);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return this.taskDetail(taskId)!;}
  replaceTaskInputs(taskId:string,inputs:any[]){
    const task=this.taskDetail(taskId);if(!task)throw new ServiceError('NOT_FOUND','Task not found',{},404);const rows=this.normalizeInputs(inputs);const at=now();this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('DELETE FROM task_inputs WHERE task_id=?').run(taskId);for(const row of rows)this.db.prepare('INSERT INTO task_inputs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(row.input_id,taskId,row.kind,row.label,row.mime,row.content,row.source,row.referenced,row.provenance,row.position,row.availability,row.reason,at,at);this.db.prepare('UPDATE tasks SET updated_at=? WHERE task_id=?').run(at,taskId);this.invalidatePlans(taskId);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return this.taskDetail(taskId)!;
  }
  refreshTaskInputs(taskId:string){for(const row of this.db.prepare("SELECT input_id,source_path FROM task_inputs WHERE task_id=? AND kind='file-reference'").all(taskId) as any[]){const available=Boolean(row.source_path&&existsSync(row.source_path));this.db.prepare('UPDATE task_inputs SET availability=?,unavailable_reason=?,updated_at=? WHERE input_id=?').run(available?'available':'unavailable',available?null:'Referenced file is missing or inaccessible',now(),row.input_id);}return this.taskDetail(taskId)!;}
  updateTaskFolders(taskId: string, input: { folder_ids: string[]; primary_folder_id: string }) {
    const task = this.taskDetail(taskId) as (Record<string, unknown> & { project_id: string }) | undefined; if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    const uniqueFolders=this.validateFolders(task.project_id,input.folder_ids,input.primary_folder_id);
    this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare('DELETE FROM task_folders WHERE task_id = ?').run(taskId); for (const folderId of uniqueFolders) this.db.prepare('INSERT INTO task_folders VALUES (?, ?, ?)').run(taskId, folderId, Number(folderId === input.primary_folder_id)); this.db.prepare('UPDATE tasks SET updated_at = ? WHERE task_id = ?').run(now(), taskId);this.invalidatePlans(taskId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.taskDetail(taskId)!;
  }
  private recipeDetail(taskId: string): any {
    const recipe = this.db.prepare('SELECT * FROM demo_recipes WHERE task_id = ?').get(taskId) as Record<string, any> | undefined;
    if (!recipe) return undefined;
    const evidence = this.db.prepare('SELECT * FROM demo_evidence WHERE recipe_id = ? ORDER BY created_at DESC').all(recipe.recipe_id) as Record<string, any>[];
    return { ...recipe, setup_commands: JSON.parse(recipe.setup_commands_json), ports: JSON.parse(recipe.ports_json), evidence: evidence.map((item) => ({ ...item, fingerprints: JSON.parse(item.fingerprints_json), checks: JSON.parse(item.checks_json) })) } as any;
  }
  private currentRecipeFingerprints(taskId: string) {
    const task = this.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    return task.folders.map((folder: any) => {
      let revision: string | null = null;
      try { revision = execFileSync('git', ['-C', folder.canonical_path, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
      return { folder_id: folder.folder_id, path: folder.canonical_path, revision, workspace_fingerprint: this.workspaceFingerprint([folder.canonical_path]) };
    });
  }
  private refreshDemoEvidence(taskId: string) {
    const recipe = this.recipeDetail(taskId); if (!recipe) return undefined;
    const current = JSON.stringify(this.currentRecipeFingerprints(taskId));
    for (const item of recipe.evidence) if (['fresh','accepted'].includes(item.status) && item.fingerprints_json !== current) this.db.prepare("UPDATE demo_evidence SET status='stale', stale_reason=? WHERE evidence_id=?").run('Repository revision or workspace fingerprint changed after this evidence.', item.evidence_id);
    return this.recipeDetail(taskId);
  }
  saveDemoRecipe(taskId: string, input: { setup_commands?: unknown; start_command?: string; readiness_command?: string; ports?: unknown; cleanup_command?: string; known_gaps?: string }) {
    if (!this.taskDetail(taskId)) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    const setup = Array.isArray(input.setup_commands) ? input.setup_commands.map(String).filter(Boolean) : [];
    const ports = Array.isArray(input.ports) ? [...new Set(input.ports.map(Number))] : [];
    if (!ports.every((port) => Number.isInteger(port) && port > 0 && port < 65536)) throw new ServiceError('VALIDATION_ERROR', 'Ports must be valid unique TCP ports.');
    for (const field of ['start_command','readiness_command','cleanup_command'] as const) if (!String(input[field] || '').trim()) throw new ServiceError('VALIDATION_ERROR', `A ${field.replace('_',' ')} is required.`);
    const existing = this.recipeDetail(taskId), at = now(), recipeId = existing?.recipe_id || id('demo');
    this.db.prepare(`INSERT INTO demo_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET setup_commands_json=excluded.setup_commands_json,start_command=excluded.start_command,readiness_command=excluded.readiness_command,ports_json=excluded.ports_json,cleanup_command=excluded.cleanup_command,known_gaps=excluded.known_gaps,updated_at=excluded.updated_at`).run(recipeId, taskId, JSON.stringify(setup), String(input.start_command).trim(), String(input.readiness_command).trim(), JSON.stringify(ports), String(input.cleanup_command).trim(), redactCodexText(String(input.known_gaps || '')), existing?.created_at || at, at);
    if (existing) this.db.prepare("UPDATE demo_evidence SET status='stale', stale_reason=? WHERE recipe_id=? AND status IN ('fresh','accepted')").run('The demo recipe changed after this evidence.', recipeId);
    return this.recipeDetail(taskId)!;
  }
  recordDemoEvidence(taskId: string, input: { checks?: unknown; preview_note?: string }) {
    const recipe = this.refreshDemoEvidence(taskId); if (!recipe) throw new ServiceError('DEMO_RECIPE_REQUIRED', 'Save a demo recipe before recording evidence.', {}, 409);
    const checks = Array.isArray(input.checks) ? input.checks.map((item: any) => ({ command: String(item.command || '').trim(), result: String(item.result || '').trim(), passed: Boolean(item.passed) })) : [];
    if (!checks.length || checks.some((item) => !item.command || !item.result)) throw new ServiceError('VALIDATION_ERROR', 'Record each check command and its result.');
    if (checks.some((item) => !item.passed)) throw new ServiceError('CHECK_FAILED', 'Failed checks cannot be recorded as fresh demo evidence.', { checks }, 409);
    const evidenceId=id('evidence'), at=now(); this.db.prepare('INSERT INTO demo_evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(evidenceId,recipe.recipe_id,JSON.stringify(this.currentRecipeFingerprints(taskId)),JSON.stringify(checks),redactCodexText(String(input.preview_note || 'Runnable preview reviewed locally.')), 'fresh',at,null,null,null);
    return this.recipeDetail(taskId)!;
  }
  acceptDemoEvidence(taskId: string, evidenceId: string, acceptedBy = 'local user') {
    const recipe=this.refreshDemoEvidence(taskId); if (!recipe) throw new ServiceError('DEMO_RECIPE_REQUIRED','Save a demo recipe before accepting evidence.',{},409); const evidence=recipe.evidence.find((item:any)=>item.evidence_id===evidenceId);
    if (!evidence || evidence.status !== 'fresh') throw new ServiceError('DEMO_EVIDENCE_STALE','Only current fresh evidence can be accepted.',{status:evidence?.status},409);
    this.db.prepare("UPDATE demo_evidence SET status='accepted',accepted_at=?,accepted_by=? WHERE evidence_id=?").run(now(),acceptedBy.trim()||'local user',evidenceId); return this.recipeDetail(taskId)!;
  }
  demoForTask(taskId: string) { return this.refreshDemoEvidence(taskId); }
  taskDetail(taskId: string): Record<string, any> | undefined { const task = this.db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined; if (!task) return undefined; return { ...task, folders: this.db.prepare('SELECT f.*, tf.is_primary FROM task_folders tf JOIN local_folders f ON f.folder_id = tf.folder_id WHERE tf.task_id = ? ORDER BY tf.rowid').all(taskId), inputs:this.db.prepare('SELECT * FROM task_inputs WHERE task_id=? ORDER BY position').all(taskId), assignments: this.db.prepare('SELECT a.*, e.name AS employee_name FROM assignments a JOIN employees e ON e.employee_id = a.employee_id WHERE a.task_id = ? AND a.ended_at IS NULL').all(taskId), plans: this.listPlansForTask(taskId), guidance: this.guidanceForTask(String(task.project_id), taskId), demo: this.recipeDetail(taskId), delivery: this.deliveryForTask(taskId) }; }
  projectDetail(projectId: string) { const project = this.getProject(projectId); if (!project) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); return { ...project, release: this.releaseState(projectId), delivery: this.delivery(projectId), folders: this.listFolders(projectId), tasks: this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map((task) => this.taskDetail((task as { task_id: string }).task_id)) }; }
  completeTask(taskId: string) { const task = this.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404); const at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare(`UPDATE tasks SET status = 'complete', updated_at = ? WHERE task_id = ?`).run(at, taskId); this.db.prepare('UPDATE assignments SET ended_at = ? WHERE task_id = ? AND ended_at IS NULL').run(at, taskId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.taskDetail(taskId)!; }
  cancelTask(taskId: string) { const task = this.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404); const at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare(`UPDATE tasks SET status = 'cancelled', updated_at = ? WHERE task_id = ?`).run(at, taskId); this.db.prepare('UPDATE assignments SET ended_at = ? WHERE task_id = ? AND ended_at IS NULL').run(at, taskId); this.addThreadEntry(taskId,'system','state','Task cancelled by the user.'); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.taskDetail(taskId)!; }
  reopenTask(taskId: string) {
    const task = this.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    const previous = this.db.prepare('SELECT assignment_id, employee_id FROM assignments WHERE task_id = ? ORDER BY assigned_at DESC LIMIT 1').get(taskId) as { assignment_id: string; employee_id: string } | undefined;
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
      try { this.reconcileCapacity(attempt.attempt_id); this.createContinuation(attempt.attempt_id, reason); this.releaseExecution(attempt.attempt_id, reason, 'lost'); released++; }
      catch (error) { if (!(error instanceof ServiceError) || error.code !== 'OWNER_STILL_ALIVE') throw error; }
    }
    for (const slot of this.db.prepare(`SELECT c.attempt_id FROM capacity_slots c JOIN worker_leases l USING(attempt_id) WHERE c.state != 'released' AND l.state NOT IN ('active','stopping')`).all() as Array<{ attempt_id: string }>) {
      try { this.reconcileCapacity(slot.attempt_id); } catch (error) { if (!(error instanceof ServiceError) || error.code !== 'OWNER_STILL_ALIVE') throw error; }
    }
    return released;
  }
  workspaceFingerprint(workspaces: string[]) { return fingerprintWorkspace(workspaces); }
  officeState() { return this.db.prepare("SELECT * FROM office_runtime WHERE runtime_id = 'local-office'").get() as Record<string, unknown>; }
  setOfficeState(state: 'open' | 'closing' | 'closed') { this.db.prepare("UPDATE office_runtime SET state = ?, updated_at = ? WHERE runtime_id = 'local-office'").run(state, now()); return this.officeState(); }
  touchClient() { const at = now(); this.db.prepare("UPDATE office_runtime SET state = 'open', last_client_at = ?, updated_at = ? WHERE runtime_id = 'local-office'").run(at, at); return this.officeState(); }
  heartbeatClient(clientId: string) { if (!clientId) throw new ServiceError('VALIDATION_ERROR', 'Client id required'); const at = now(); this.db.prepare('INSERT INTO office_clients VALUES (?, ?, ?) ON CONFLICT(client_id) DO UPDATE SET heartbeat_at = excluded.heartbeat_at').run(clientId, at, at); this.touchClient(); return this.clientCount(); }
  disconnectClient(clientId: string) { this.db.prepare('DELETE FROM office_clients WHERE client_id = ?').run(clientId); return this.clientCount(); }
  expireClients(cutoffIso: string) { this.db.prepare('DELETE FROM office_clients WHERE heartbeat_at < ?').run(cutoffIso); return this.clientCount(); }
  clientCount() { return Number((this.db.prepare('SELECT COUNT(*) AS count FROM office_clients').get() as { count: number }).count); }
  continuations(state?: string) { return this.db.prepare(`SELECT c.*, s.task_id, s.employee_id, t.project_id FROM continuation_records c JOIN sessions s USING(session_id) JOIN tasks t USING(task_id) ${state ? 'WHERE c.state = ?' : ''} ORDER BY c.created_at`).all(...(state ? [state] : [])) as Record<string, any>[]; }
  createContinuation(attemptId: string, reason: string, desiredState: 'eligible' | 'blocked' = 'eligible') {
    const detail = this.executionDetail(attemptId), workspace = detail.workspace_set as string[];
    const existing = this.db.prepare('SELECT * FROM continuation_records WHERE source_attempt_id = ?').get(attemptId) as Record<string, unknown> | undefined;
    if (existing) return existing;
    const continuationId = id('cont'), fingerprint = String(detail.workspace_fingerprint || this.workspaceFingerprint(workspace));
    this.db.prepare('UPDATE attempts SET workspace_fingerprint = ? WHERE attempt_id = ?').run(fingerprint, attemptId);
    this.db.prepare('INSERT INTO continuation_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)').run(continuationId, detail.session_id, attemptId, reason, desiredState, detail.provider_thread_id || null, JSON.stringify(workspace), fingerprint, `Continue ${detail.task_title} after ${reason}.`, now());
    return this.db.prepare('SELECT * FROM continuation_records WHERE continuation_id = ?').get(continuationId);
  }
  reviewContinuation(continuationId: string) {
    const row = this.db.prepare('SELECT * FROM continuation_records WHERE continuation_id = ?').get(continuationId) as Record<string, any> | undefined;
    if (!row) throw new ServiceError('NOT_FOUND', 'Continuation not found', {}, 404);
    const current = this.workspaceFingerprint(JSON.parse(String(row.workspace_set_json)));
    if (current !== row.workspace_fingerprint) this.db.prepare("UPDATE continuation_records SET state = 'blocked', reason = 'workspace_changed', reviewed_at = ? WHERE continuation_id = ?").run(now(), continuationId);
    return { ...(this.db.prepare('SELECT * FROM continuation_records WHERE continuation_id = ?').get(continuationId) as object), current_fingerprint: current, fingerprint_matches: current === row.workspace_fingerprint };
  }
  cancelContinuationsFor(scope: { task_id?: string; employee_id?: string; project_id?: string }) {
    const clauses: string[] = [], values: string[] = [];
    if (scope.task_id) { clauses.push('s.task_id = ?'); values.push(scope.task_id); }
    if (scope.employee_id) { clauses.push('s.employee_id = ?'); values.push(scope.employee_id); }
    if (scope.project_id) { clauses.push('t.project_id = ?'); values.push(scope.project_id); }
    if (!clauses.length) return;
    this.db.prepare(`UPDATE continuation_records SET state = 'cancelled', reason = 'manual_stop' WHERE state IN ('eligible','blocked') AND session_id IN (SELECT s.session_id FROM sessions s JOIN tasks t USING(task_id) WHERE ${clauses.join(' AND ')})`).run(...values);
  }
  pauseProject(projectId: string, paused: boolean) { if (!this.getProject(projectId)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); this.db.prepare('UPDATE projects SET execution_state = ?, pause_reason = ? WHERE project_id = ?').run(paused ? 'paused' : 'active', paused ? 'manual_pause' : null, projectId); if (paused) this.cancelContinuationsFor({ project_id: projectId }); return this.getProject(projectId); }
  executionDetail(attemptId: string): Record<string, any> {
    const attempt = this.db.prepare(`SELECT a.*, s.task_id, s.employee_id, s.purpose, s.continuation_state, t.project_id, t.title AS task_title, e.name AS employee_name, l.lease_id, l.state AS lease_state, l.stop_reason FROM attempts a JOIN sessions s ON s.session_id = a.session_id JOIN tasks t ON t.task_id = s.task_id JOIN employees e ON e.employee_id = s.employee_id LEFT JOIN worker_leases l ON l.attempt_id = a.attempt_id WHERE a.attempt_id = ?`).get(attemptId) as Record<string, unknown> | undefined;
    if (!attempt) throw new ServiceError('NOT_FOUND', 'Execution not found', {}, 404);
    const session=this.db.prepare('SELECT resolved_context_json FROM sessions WHERE session_id=?').get(String(attempt.session_id)) as {resolved_context_json:string};
    return { ...attempt, resolved_context:JSON.parse(session.resolved_context_json||'{}'), workspace_set: JSON.parse(String(attempt.workspace_set_json)), events: this.db.prepare('SELECT event_id, sequence, at, kind, payload_json, adapter FROM attempt_events WHERE attempt_id = ? ORDER BY sequence').all(attemptId).map((event: Record<string, unknown>) => ({ ...event, payload: JSON.parse(String(event.payload_json)) })), messages: this.db.prepare('SELECT * FROM follow_up_messages WHERE session_id = ? ORDER BY queued_at').all(String(attempt.session_id)) };
  }
  startExecution(input: { task_id: string; employee_id: string; purpose: string; workspace_set: string[]; resolved_context?:Record<string,unknown> }) {
    const task = this.taskDetail(input.task_id); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
    const pendingDecision = this.pendingDecisionForTask(input.task_id); if (pendingDecision) throw new ServiceError('DECISION_APPROVAL_REQUIRED', 'Approve the current decision version before dispatching this task.', { decision_id: pendingDecision.decision_id, current_version: pendingDecision.current_version }, 409);
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
        const active=this.activeAttempt() as any;
        throw new ServiceError(active?.task_id===input.task_id ? 'WORKER_LEASE_CONFLICT' : 'WAITING_FOR_CAPACITY', reason, { capacity }, 409);
      }
      this.captureTaskDeliveryBaselines(task);
      const context=input.resolved_context||this.resolvedContext(input.employee_id,String(task.project_id),input.task_id,input.purpose);
      this.db.prepare('INSERT INTO sessions (session_id,task_id,employee_id,purpose,continuation_state,created_at,resolved_context_json) VALUES (?,?,?,?,?,?,?)').run(session_id, input.task_id, input.employee_id, redactCodexText(input.purpose), 'running', at, JSON.stringify(context));
      this.db.prepare('INSERT INTO attempts (attempt_id, session_id, provider_thread_id, provider_turn_id, provider_item_id, provider_process_id, workspace_set_json, created_at, workspace_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(attempt_id, session_id, null, null, null, null, JSON.stringify(input.workspace_set), at, this.workspaceFingerprint(input.workspace_set));
      this.db.prepare('INSERT INTO worker_leases (lease_id, attempt_id, state, heartbeat_at, released_at, stop_reason, owner_token) VALUES (?, ?, ?, ?, ?, ?, ?)').run(lease_id, attempt_id, 'active', at, null, null, null);
      this.db.prepare('INSERT INTO capacity_slots VALUES (?, ?, ?, ?, NULL)').run(attempt_id, env.host_id, env.environment_id, 'reserved');
      this.db.prepare('DELETE FROM capacity_waits WHERE task_id = ?').run(input.task_id);
      this.db.exec('COMMIT');
    } catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
    return this.executionDetail(attempt_id);
  }
  resumeContinuation(continuationId: string): Record<string, any> {
    const reviewed = this.reviewContinuation(continuationId) as Record<string, any>;
    if (reviewed.state !== 'eligible') throw new ServiceError('RECOVERY_REVIEW_REQUIRED', 'This continuation is blocked and needs review.', { reason: reviewed.reason }, 409);
    const source = this.executionDetail(String(reviewed.source_attempt_id));
    const project = this.getProject(String(source.project_id));
    if (project?.execution_state === 'paused' || project?.status !== 'active') throw new ServiceError('PROJECT_PAUSED', 'Resume the project before continuing.', {}, 409);
    if (this.listInbox('pending').some((item: any) => item.task_id === reviewed.task_id)) throw new ServiceError('ATTENTION_REQUIRED', 'A pending request blocks automatic resume.', {}, 409);
    const env = this.employeeEnvironment(String(reviewed.employee_id)), workspace = JSON.parse(String(reviewed.workspace_set_json)) as string[];
    const at = now(), attemptId = id('att'), leaseId = id('lease');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const capacity = this.hostCapacity(String(env.host_id));
      if (capacity.occupied >= capacity.effective_limit || this.activeAttempt()) throw new ServiceError('WAITING_FOR_CAPACITY', 'Waiting for capacity before automatic resume.', { capacity }, 409);
      this.db.prepare('INSERT INTO attempts (attempt_id, session_id, provider_thread_id, provider_turn_id, provider_item_id, provider_process_id, workspace_set_json, created_at, workspace_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(attemptId, reviewed.session_id, reviewed.provider_thread_id || null, null, null, null, JSON.stringify(workspace), at, reviewed.workspace_fingerprint);
      this.db.prepare('INSERT INTO worker_leases (lease_id, attempt_id, state, heartbeat_at, released_at, stop_reason, owner_token) VALUES (?, ?, ?, ?, ?, ?, ?)').run(leaseId, attemptId, 'active', at, null, null, null);
      this.db.prepare('INSERT INTO capacity_slots VALUES (?, ?, ?, ?, NULL)').run(attemptId, env.host_id, env.environment_id, 'reserved');
      this.db.prepare("UPDATE sessions SET continuation_state = 'running' WHERE session_id = ?").run(reviewed.session_id);
      this.db.exec('COMMIT');
    } catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
    const started = this.executionDetail(attemptId);
    return { ...started, resume_thread_id: reviewed.provider_thread_id || null };
  }
  markContinuationResumed(continuationId: string, attemptId: string) { this.db.prepare("UPDATE continuation_records SET state = 'resumed', resumed_attempt_id = ?, reviewed_at = ? WHERE continuation_id = ? AND state = 'eligible'").run(attemptId, now(), continuationId); }
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
  activateCapacity(attemptId: string, pid: number, ownerToken?: string) { this.db.prepare("UPDATE capacity_slots SET state = 'active', owner_pid = ? WHERE attempt_id = ? AND state = 'reserved'").run(pid, attemptId); this.db.prepare('UPDATE worker_leases SET owner_token = ? WHERE attempt_id = ?').run(ownerToken || null, attemptId); }
  reconcileCapacity(attemptId: string) {
    const slot = this.db.prepare('SELECT * FROM capacity_slots WHERE attempt_id = ?').get(attemptId) as any;
    if (slot?.owner_pid) {
      try {
        process.kill(slot.owner_pid, 0);
        let command = '';
        try { command = execFileSync('/bin/ps', ['-p', String(slot.owner_pid), '-o', 'command='], { encoding: 'utf8', timeout: 1000 }).trim(); } catch {}
        if (/\bcodex\b.*\bapp-server\b/.test(command)) throw new ServiceError('OWNER_STILL_ALIVE', 'Capacity remains occupied until the verified owned app-server exits.', { pid: slot.owner_pid }, 409);
        this.appendEvent(attemptId, 'attempt.pid_reuse_ignored', { pid: slot.owner_pid, observed_command: command.slice(0, 200) });
      } catch (e: any) { if (e instanceof ServiceError) throw e; if (e.code !== 'ESRCH') throw e; }
    }
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
    const decision = this.pendingDecisionForTask(task.task_id);
    const lastEntry = this.db.prepare('SELECT body, created_at FROM task_thread_entries WHERE task_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(task.task_id) as { body: string; created_at: string } | undefined;
    const terminal = ['complete','cancelled'].includes(task.status);
    const reason = terminal ? '' : decision ? `Decision approval required: ${decision.title} v${decision.current_version}.` : request?.blocks || (working ? '' : !this.approvedPlanForTask(task.task_id) ? 'Current plan approval required.' : !owner ? 'Assign a coworker.' : env?.kind === 'coder' ? 'Coder not connected; execution arrives in milestone 6.' : wait?.reason || '');
    return { ...task, project_name: this.getProject(task.project_id)?.name, employee_id: owner?.employee_id || null, employee_name: owner ? this.getEmployee(owner.employee_id)?.name : null, environment: env, attempt, last_meaningful_update: lastEntry ? { summary: lastEntry.body, at: lastEntry.created_at } : { summary: task.title, at: task.updated_at }, blocking_reason: reason, working_state: task.status === 'complete' ? 'complete' : task.status === 'cancelled' ? 'cancelled' : working ? 'working' : reason ? (wait && !request && this.approvedPlanForTask(task.task_id) && env?.kind === 'local' ? 'waiting for capacity' : 'blocked') : 'planned' };
  }); }
  setProviderIdentity(attemptId: string, values: { threadId?: string | null; turnId?: string | null; itemId?: string | null; processId?: string | null }) { this.db.prepare('UPDATE attempts SET provider_thread_id = COALESCE(?, provider_thread_id), provider_turn_id = COALESCE(?, provider_turn_id), provider_item_id = COALESCE(?, provider_item_id), provider_process_id = COALESCE(?, provider_process_id) WHERE attempt_id = ?').run(values.threadId ?? null, values.turnId ?? null, values.itemId ?? null, values.processId ?? null, attemptId); }
  appendEvent(attemptId: string, kind: string, payload: Record<string, unknown>, providerEventId: string | null = null) { const previous = this.db.prepare('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM attempt_events WHERE attempt_id = ?').get(attemptId) as { sequence: number }; if (providerEventId && this.db.prepare('SELECT 1 FROM attempt_events WHERE adapter = ? AND provider_event_id = ?').get('codex-app-server', providerEventId)) return; this.db.prepare('INSERT INTO attempt_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id('evt'), attemptId, previous.sequence + 1, now(), kind, redactCodexText(JSON.stringify(payload)), 'codex-app-server', providerEventId); }
  queueMessage(sessionId: string, content: string) { const message_id = id('msg'), at = now(); this.db.prepare('INSERT INTO follow_up_messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(message_id, sessionId, redactCodexText(content), 'queued', at, null, null); return message_id; }
  markMessage(messageId: string, state: 'delivering' | 'delivered' | 'failed' | 'cancelled', attemptId?: string) { this.db.prepare('UPDATE follow_up_messages SET state = ?, delivered_at = ?, delivery_attempt_id = ? WHERE message_id = ?').run(state, state === 'delivered' ? now() : null, attemptId ?? null, messageId); }
  releaseExecution(attemptId: string, reason: string, state: 'released' | 'lost' = 'released') { const at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare('UPDATE worker_leases SET state = ?, released_at = ?, stop_reason = ?, heartbeat_at = ? WHERE attempt_id = ?').run(state, at, reason, at, attemptId); this.db.prepare(`UPDATE sessions SET continuation_state = ? WHERE session_id = (SELECT session_id FROM attempts WHERE attempt_id = ?)` ).run(state === 'released' ? 'stopped' : 'lost', attemptId); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  preferences() { return this.db.prepare(`SELECT * FROM office_preferences WHERE preference_id = 'local-user'`).get(); }
  updatePreferences(values: { map_treatment?: 'warm' | 'cool' | 'editorial'; reduced_motion?: boolean }) { const old = this.preferences() as { map_treatment: 'warm' | 'cool' | 'editorial'; reduced_motion: number }; const treatment = values.map_treatment ?? old.map_treatment; if (!['warm', 'cool', 'editorial'].includes(treatment)) throw new ServiceError('VALIDATION_ERROR', 'Unknown map treatment'); this.db.prepare(`UPDATE office_preferences SET map_treatment = ?, reduced_motion = ?, updated_at = ? WHERE preference_id = 'local-user'`).run(treatment, values.reduced_motion === undefined ? old.reduced_motion : Number(values.reduced_motion), now()); return this.preferences(); }
  decisionDetail(decisionId: string): Record<string, any> | undefined {
    const meeting = this.db.prepare(`SELECT d.*, p.name AS project_name, e.name AS employee_name FROM decision_meetings d JOIN projects p USING(project_id) LEFT JOIN employees e USING(employee_id) WHERE decision_id = ?`).get(decisionId) as Record<string, unknown> | undefined;
    if (!meeting) return undefined;
    const versions: Record<string, any>[] = (this.db.prepare('SELECT * FROM decision_versions WHERE decision_id = ? ORDER BY version DESC').all(decisionId) as Record<string, unknown>[]).map((version) => ({ ...version, options: JSON.parse(String(version.options_json)), affected_task_ids: JSON.parse(String(version.affected_task_ids_json)), gated_task_ids: JSON.parse(String(version.gated_task_ids_json)) }));
    return { ...meeting, versions, current: versions.find((version) => Number(version.version) === Number(meeting.current_version)) };
  }
  listDecisions(projectId?: string) { return (this.db.prepare(`SELECT decision_id FROM decision_meetings ${projectId ? 'WHERE project_id = ?' : ''} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, updated_at DESC`).all(...(projectId ? [projectId] : [])) as Array<{ decision_id: string }>).map(({ decision_id }) => this.decisionDetail(decision_id)!); }
  private validateDecisionTasks(projectId: string, values: unknown) { const ids = [...new Set(Array.isArray(values) ? values.map(String) : [])]; for (const taskId of ids) { const task = this.taskDetail(taskId); if (!task || task.project_id !== projectId) throw new ServiceError('INVALID_DECISION_SCOPE', 'Every affected or gated task must belong to the meeting project.', { task_id: taskId }, 409); } return ids; }
  createDecision(input: { project_id: string; employee_id?: string; kind: 'ui' | 'technical'; title: string; recommendation: string; options: unknown; affected_task_ids?: unknown; gated_task_ids?: unknown }) {
    if (!this.getProject(input.project_id)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404);
    if (!['ui','technical'].includes(input.kind) || !input.title?.trim() || !input.recommendation?.trim() || !Array.isArray(input.options) || input.options.length < 2) throw new ServiceError('VALIDATION_ERROR', 'A decision needs a type, title, recommendation, and at least two options.');
    if (input.employee_id && !this.getEmployee(input.employee_id)) throw new ServiceError('NOT_FOUND', 'Employee not found', {}, 404);
    const affected = this.validateDecisionTasks(input.project_id, input.affected_task_ids), gated = this.validateDecisionTasks(input.project_id, input.gated_task_ids), decisionId = id('dec'), at = now();
    this.db.exec('BEGIN IMMEDIATE'); try {
      this.db.prepare('INSERT INTO decision_meetings VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)').run(decisionId, input.project_id, input.employee_id || null, input.kind, input.title.trim(), 'pending', at, at);
      this.db.prepare('INSERT INTO decision_versions VALUES (?, 1, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL)').run(decisionId, redactCodexText(input.recommendation.trim()), JSON.stringify(input.options), JSON.stringify(affected), JSON.stringify(gated), 'current', at);
      const requestId = id('req'); this.db.prepare('INSERT INTO inbox_requests (request_id,project_id,employee_id,task_id,kind,summary,detail,blocks,source,status,created_at,resolved_at,decision_id,decision_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(requestId,input.project_id,input.employee_id||null,gated[0]||affected[0]||null,'decision',input.title.trim(),`Review ${input.kind} decision version 1.`,gated.length?`Approval gates ${gated.length} linked task(s).`:'No task is gated; linked work may continue.','codex','pending',at,null,decisionId,1);
      for(const taskId of [...new Set([...affected,...gated])]) this.addThreadEntry(taskId,'coworker','state',`Decision requested: ${input.title.trim()} (version 1).`,`decision:${decisionId}:v1`);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.decisionDetail(decisionId)!;
  }
  reviseDecision(decisionId: string, input: { expected_version: number; recommendation: string; options: unknown; feedback: string; affected_task_ids?: unknown; gated_task_ids?: unknown }) {
    const meeting = this.decisionDetail(decisionId); if (!meeting) throw new ServiceError('NOT_FOUND', 'Decision meeting not found', {}, 404);
    if (Number(input.expected_version) !== Number(meeting.current_version)) throw new ServiceError('STALE_DECISION_VERSION', 'The meeting changed; reload before revising.', { current_version: meeting.current_version }, 409);
    if (!input.feedback?.trim() || !input.recommendation?.trim() || !Array.isArray(input.options) || input.options.length < 2) throw new ServiceError('VALIDATION_ERROR', 'A revision needs feedback, recommendation, and at least two options.');
    const affected=this.validateDecisionTasks(meeting.project_id,input.affected_task_ids), gated=this.validateDecisionTasks(meeting.project_id,input.gated_task_ids), version=Number(meeting.current_version)+1, at=now();
    this.db.exec('BEGIN IMMEDIATE'); try {
      this.db.prepare("UPDATE decision_versions SET status='superseded' WHERE decision_id=? AND status IN ('current','approved')").run(decisionId);
      this.db.prepare("UPDATE decision_meetings SET status='pending',current_version=?,updated_at=? WHERE decision_id=?").run(version,at,decisionId);
      this.db.prepare('INSERT INTO decision_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(decisionId,version,redactCodexText(input.recommendation.trim()),JSON.stringify(input.options),redactCodexText(input.feedback.trim()),JSON.stringify(affected),JSON.stringify(gated),'current',at,null,null);
      this.db.prepare("UPDATE inbox_requests SET status='resolved',resolved_at=? WHERE decision_id=? AND status='pending'").run(at,decisionId);
      this.db.prepare('INSERT INTO inbox_requests (request_id,project_id,employee_id,task_id,kind,summary,detail,blocks,source,status,created_at,resolved_at,decision_id,decision_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id('req'),meeting.project_id,meeting.employee_id||null,gated[0]||affected[0]||null,'decision',meeting.title,`Review revised ${meeting.kind} decision version ${version}.`,gated.length?`Approval gates ${gated.length} linked task(s).`:'No task is gated; linked work may continue.','codex','pending',at,null,decisionId,version);
      for(const taskId of [...new Set([...affected,...gated])]) this.addThreadEntry(taskId,'coworker','state',`Decision revised: ${meeting.title} (version ${version}).`,`decision:${decisionId}:v${version}`);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
    return this.decisionDetail(decisionId)!;
  }
  approveDecision(decisionId: string, input: { version: number; approved_by?: string }) {
    const meeting=this.decisionDetail(decisionId); if(!meeting) throw new ServiceError('NOT_FOUND','Decision meeting not found',{},404);
    if(meeting.status!=='pending'||Number(input.version)!==Number(meeting.current_version)) throw new ServiceError('STALE_DECISION_VERSION','Only the current pending version can be approved.',{current_version:meeting.current_version,status:meeting.status},409);
    const current=meeting.current, at=now(), approver=input.approved_by?.trim()||'local user';
    this.db.exec('BEGIN IMMEDIATE'); try {
      this.db.prepare("UPDATE decision_versions SET status='approved',approved_at=?,approved_by=? WHERE decision_id=? AND version=? AND status='current'").run(at,approver,decisionId,input.version);
      this.db.prepare("UPDATE decision_meetings SET status='approved',updated_at=? WHERE decision_id=?").run(at,decisionId);
      this.db.prepare("UPDATE inbox_requests SET status='resolved',resolved_at=?,response_text=? WHERE decision_id=? AND status='pending'").run(at,`Approved version ${input.version} by ${approver}.`,decisionId);
      this.db.prepare("UPDATE guidance_records SET state='corrected',retired_at=? WHERE project_id=? AND state='active' AND provenance LIKE ?").run(at,meeting.project_id,`decision:${decisionId}:v%`);
      const guidanceId=id('guide'), content=`${meeting.title}: ${current.recommendation}`; this.db.prepare('INSERT INTO guidance_records (guidance_id,project_id,scope,task_id,content,provenance,state,replaces_guidance_id,created_at,retired_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(guidanceId,meeting.project_id,'project',null,redactCodexText(content),`decision:${decisionId}:v${input.version}`,'active',null,at,null);
      for(const taskId of [...new Set([...current.affected_task_ids,...current.gated_task_ids])]) this.addThreadEntry(taskId,'system','state',`Decision ${meeting.title} version ${input.version} approved by ${approver}.`,`decision:${decisionId}:approved:${input.version}`);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
    return this.decisionDetail(decisionId)!;
  }
  pendingDecisionForTask(taskId: string) { return this.listDecisions().find((meeting:any)=>meeting.status==='pending'&&meeting.current.gated_task_ids.includes(taskId)); }
  listInbox(status?: 'pending' | 'resolved'): Record<string, any>[] { return this.db.prepare(`SELECT r.*, p.name AS project_name, e.name AS employee_name, t.title AS task_title, m.state AS message_state FROM inbox_requests r JOIN projects p ON p.project_id = r.project_id LEFT JOIN employees e ON e.employee_id = r.employee_id LEFT JOIN tasks t ON t.task_id = r.task_id LEFT JOIN follow_up_messages m ON m.message_id = r.message_id ${status ? 'WHERE r.status = ?' : ''} ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`).all(...(status ? [status] : [])); }
  createSimulatedRequest(input: { project_id: string; employee_id?: string; task_id?: string; kind?: string; summary?: string; detail?: string; blocks?: string }) { if (!this.getProject(input.project_id)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); const request_id = id('req'), at = now(); const kind = input.kind || 'clarification'; const summary = input.summary?.trim() || 'Confirm the next room priority'; const detail = input.detail?.trim() || 'This is a labeled simulated request for the Packet 1B inbox shell. It shows the reading surface for a longer technical question without sending a message, starting a worker, or approving anything. A later execution packet must replace this entry with a persisted adapter event before the office can claim that work is actually blocked or awaiting a user response.'; const blocks = input.blocks?.trim() || 'No execution is running; this only demonstrates the inbox route and its readable request-details boundary.'; this.db.prepare('INSERT INTO inbox_requests (request_id, project_id, employee_id, task_id, kind, summary, detail, blocks, source, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(request_id, input.project_id, input.employee_id || null, input.task_id || null, kind, summary, detail, blocks, 'simulated', 'pending', at, null); return this.listInbox().find((request: any) => request.request_id === request_id); }
  resolveRequest(requestId: string) { const existing = this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId) as Record<string,unknown>|undefined; if (!existing) throw new ServiceError('NOT_FOUND', 'Inbox request not found', {}, 404); if(existing.decision_id) throw new ServiceError('DECISION_APPROVAL_REQUIRED','Decision meetings resolve only by approving the current version.',{decision_id:existing.decision_id},409); this.db.prepare(`UPDATE inbox_requests SET status = 'resolved', resolved_at = ? WHERE request_id = ?`).run(now(), requestId); return this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId); }
  createPlan(input: { project_id: string; task_id: string; summary: string; milestones?: unknown; acceptance?: unknown; dependencies?: unknown }) {
    const task = this.taskDetail(input.task_id) as { project_id: string } | undefined;
    if (!task || task.project_id !== input.project_id) throw new ServiceError('INVALID_PLAN_TASK', 'A plan must target a task in its project', {}, 409);
    if (!input.summary.trim()) throw new ServiceError('VALIDATION_ERROR', 'A plan summary is required');
    const version = Number((this.db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM plan_proposals WHERE project_id = ?').get(input.project_id) as { version: number }).version) + 1;
    const plan_id = id('plan'), at = now(); this.db.exec('BEGIN IMMEDIATE'); try {
      this.db.prepare(`UPDATE plan_proposals SET status = 'superseded' WHERE task_id = ? AND status IN ('pending', 'approved')`).run(input.task_id);
      this.db.prepare('INSERT INTO plan_proposals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(plan_id, input.project_id, input.task_id, version, 'pending', redactCodexText(input.summary.trim()), JSON.stringify(input.milestones || []), JSON.stringify(input.acceptance || []), JSON.stringify(input.dependencies || []), at, null, null);
      this.addThreadEntry(input.task_id,'coworker','state',`Plan version ${version} proposed: ${input.summary.trim()}`,`plan:${plan_id}:proposed`);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.planDetail(plan_id)!;
  }
  planDetail(planId: string): Record<string, any> | undefined { const plan = this.db.prepare('SELECT * FROM plan_proposals WHERE plan_id = ?').get(planId) as Record<string, unknown> | undefined; return plan ? { ...plan, milestones: JSON.parse(String(plan.milestones_json)), acceptance: JSON.parse(String(plan.acceptance_json)), dependencies: JSON.parse(String(plan.dependencies_json)) } : undefined; }
  listPlansForTask(taskId: string) { return (this.db.prepare('SELECT plan_id FROM plan_proposals WHERE task_id = ? ORDER BY version DESC').all(taskId) as Array<{ plan_id: string }>).map(({ plan_id }) => this.planDetail(plan_id)!); }
  approvePlan(planId: string, approvedBy: string) { const plan = this.planDetail(planId); if (!plan) throw new ServiceError('NOT_FOUND', 'Plan not found', {}, 404); if (plan.status !== 'pending') throw new ServiceError('PLAN_NOT_APPROVABLE', 'Only the current pending plan can be approved.', { status: plan.status }, 409); const approver=approvedBy.trim() || 'local user'; this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare(`UPDATE plan_proposals SET status = 'superseded' WHERE task_id = ? AND plan_id != ? AND status = 'approved'`).run(plan.task_id, planId); this.db.prepare(`UPDATE plan_proposals SET status = 'approved', approved_at = ?, approved_by = ? WHERE plan_id = ?`).run(now(), approver, planId); this.addThreadEntry(String(plan.task_id),'system','state',`Plan version ${plan.version} approved by ${approver}.`,`plan:${planId}:approved`); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.planDetail(planId)!; }
  approvedPlanForTask(taskId: string) { return this.db.prepare(`SELECT plan_id FROM plan_proposals WHERE task_id = ? AND status = 'approved' ORDER BY approved_at DESC LIMIT 1`).get(taskId) as { plan_id: string } | undefined; }
  guidanceForTask(projectId: string, taskId: string) { return this.db.prepare(`SELECT * FROM guidance_records WHERE project_id = ? AND state = 'active' AND (scope = 'project' OR task_id = ?) ORDER BY CASE scope WHEN 'task' THEN 0 ELSE 1 END, created_at DESC`).all(projectId, taskId); }
  addGuidance(input: { project_id: string; task_id?: string; content: string; provenance: string; replaces_guidance_id?: string }) { if (!this.getProject(input.project_id)) throw new ServiceError('NOT_FOUND', 'Project not found', {}, 404); if (!input.content.trim() || !input.provenance.trim()) throw new ServiceError('VALIDATION_ERROR', 'Guidance needs content and provenance'); if (input.task_id) { const task = this.taskDetail(input.task_id) as { project_id: string } | undefined; if (!task || task.project_id !== input.project_id) throw new ServiceError('INVALID_GUIDANCE_SCOPE', 'Task guidance must belong to this project', {}, 409); } const guidance_id = id('guide'), at = now(); this.db.exec('BEGIN IMMEDIATE'); try { if (input.replaces_guidance_id) this.db.prepare(`UPDATE guidance_records SET state = 'corrected', retired_at = ? WHERE guidance_id = ? AND project_id = ?`).run(at, input.replaces_guidance_id, input.project_id); this.db.prepare('INSERT INTO guidance_records (guidance_id, project_id, scope, task_id, content, provenance, state, replaces_guidance_id, created_at, retired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(guidance_id, input.project_id, input.task_id ? 'task' : 'project', input.task_id || null, redactCodexText(input.content.trim()), input.provenance.trim(), 'active', input.replaces_guidance_id || null, at, null); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; } return this.db.prepare('SELECT * FROM guidance_records WHERE guidance_id = ?').get(guidance_id); }
  retireGuidance(guidanceId: string) { const result = this.db.prepare(`UPDATE guidance_records SET state = 'retired', retired_at = ? WHERE guidance_id = ? AND state = 'active'`).run(now(), guidanceId); if (!result.changes) throw new ServiceError('NOT_FOUND', 'Active guidance not found', {}, 404); return this.db.prepare('SELECT * FROM guidance_records WHERE guidance_id = ?').get(guidanceId); }
  createRealRequest(input: { project_id: string; employee_id: string; task_id: string; kind: string; summary: string; detail: string; blocks: string; message_id?: string }) { const request_id = id('req'), at = now(); this.db.exec('BEGIN IMMEDIATE'); try { this.db.prepare('INSERT INTO inbox_requests (request_id, project_id, employee_id, task_id, kind, summary, detail, blocks, source, status, created_at, resolved_at, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(request_id, input.project_id, input.employee_id, input.task_id, input.kind, input.summary, redactCodexText(input.detail), input.blocks, 'codex', 'pending', at, null, input.message_id || null); this.addThreadEntry(input.task_id,'coworker','state',`${input.summary}: ${input.blocks}`,`request:${request_id}`); this.db.exec('COMMIT'); } catch(error) { this.db.exec('ROLLBACK'); throw error; } return this.listInbox().find((request: any) => request.request_id === request_id); }
  createAgentRequest(attemptId: string, text: string, providerItemId?: string) {
    const match = text.match(/\[PIXEL_REQUEST\]\s*(clarification|approval|revision)\s*\|\s*([^|\n]{3,180})\s*\|\s*([^\n]{3,500})/i);
    if (!match) return undefined;
    const attempt = this.executionDetail(attemptId);
    const detail = redactCodexText(text).slice(0, 4000);
    const seen = this.db.prepare(`SELECT request_id FROM inbox_requests WHERE task_id = ? AND source = 'codex' AND detail = ? LIMIT 1`).get(attempt.task_id, detail);
    if (seen) return undefined;
    return this.createRealRequest({ project_id: String((this.taskDetail(String(attempt.task_id)) as any).project_id), employee_id: String(attempt.employee_id), task_id: String(attempt.task_id), kind: match[1].toLowerCase(), summary: match[2].trim(), blocks: match[3].trim(), detail, message_id: providerItemId });
  }
  answerRequest(requestId: string, response: string) { const request = this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId) as Record<string, unknown> | undefined; if (!request || request.status !== 'pending') throw new ServiceError('NOT_FOUND', 'Pending inbox request not found', {}, 404); if(request.decision_id) throw new ServiceError('DECISION_APPROVAL_REQUIRED','Decision feedback must create a revised version; acknowledgement cannot approve or resolve it.',{decision_id:request.decision_id},409); this.db.prepare(`UPDATE inbox_requests SET status = 'resolved', resolved_at = ?, response_text = ? WHERE request_id = ?`).run(now(), redactCodexText(response.trim()), requestId); return this.db.prepare('SELECT * FROM inbox_requests WHERE request_id = ?').get(requestId); }
}
