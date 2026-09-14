import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PixelDatabase } from '../src/database.js';
import { capacityPolicy, GiB } from '../src/capacity.js';
const sample = (cpu=8, available=24*GiB) => ({cpu,total:32*GiB,available,measured_at:Date.now(),source:'deterministic fixture'});
function setup() { const db=new PixelDatabase(join(mkdtempSync(join(tmpdir(),'capacity-')),'db.sqlite')); db.measureHost('local',sample()); const p=db.createProject('Fixture'); const f=db.attachFolder(p.project_id,'/fixture','/fixture'); const employee=db.createEmployee({name:'One employee'}); const task=db.createTask({project_id:p.project_id,title:'One task',employee_id:employee.employee_id,folder_ids:[f.folder_id],primary_folder_id:f.folder_id}); const plan=db.createPlan({project_id:p.project_id,task_id:task.task_id,summary:'Fixture'});db.approvePlan(plan.plan_id,'test');return {db,employee,task,input:{task_id:task.task_id,employee_id:employee.employee_id,purpose:'Fixture',workspace_set:['/fixture']}}; }
test('CPU, memory, missing, stale and lower ceilings are conservative',()=>{
 assert.equal(capacityPolicy(sample(4)).resource_limit,1);
 assert.equal(capacityPolicy(sample(32,8*GiB)).resource_limit,1);
 assert.equal(capacityPolicy(null).effective_limit,0);
 assert.equal(capacityPolicy({...sample(),measured_at:Date.now()-31_000}).effective_limit,0);
 assert.equal(capacityPolicy(sample(),0).effective_limit,0);
 assert.equal(capacityPolicy(sample(64)).effective_limit,1);
});
test('simultaneous admissions reserve once, retain waiting work, and reconcile before release',async()=>{
 const {db,input,task}=setup();
 const results=await Promise.allSettled([Promise.resolve().then(()=>db.startExecution(input)),Promise.resolve().then(()=>db.startExecution(input))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(db.hostCapacity('local').reserved,1);
 assert.ok(db.db.prepare('SELECT * FROM capacity_waits WHERE task_id=?').get(task.task_id));
 const attempt=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
 db.activateCapacity(attempt.attempt_id,process.pid);
 // The fixture PID belongs to Node, not the recorded Codex app-server. Reconciliation
 // treats it as PID reuse instead of retaining or signalling an unrelated process.
 assert.doesNotThrow(()=>db.reconcileCapacity(attempt.attempt_id));
 db.db.prepare("UPDATE capacity_slots SET state='active',owner_pid=NULL WHERE attempt_id=?").run(attempt.attempt_id);
 db.releaseExecution(attempt.attempt_id,'cancel');
 assert.equal(db.hostCapacity('local').occupied,1);
 db.db.prepare('UPDATE capacity_slots SET owner_pid=NULL WHERE attempt_id=?').run(attempt.attempt_id); // fixture acknowledges process exit
 db.reconcileCapacity(attempt.attempt_id);
 assert.equal(db.hostCapacity('local').occupied,0);
 db.startExecution(input);assert.equal(db.taskBoard()[0].working_state,'working');db.close();
});
test('shared host and multiple sessions count slots rather than employees; decreases keep work',()=>{
 const {db,input}=setup(); const attempt=db.startExecution(input);
 db.db.prepare("INSERT INTO execution_environments VALUES ('sibling','local','Shared host fixture','coder','disconnected',1)").run();
 const sid='fixture-session',aid='fixture-attempt';db.db.prepare('INSERT INTO sessions (session_id,task_id,employee_id,purpose,continuation_state,created_at) VALUES (?,?,?,?,?,?)').run(sid,input.task_id,input.employee_id,'Second session fixture','running',new Date().toISOString());db.db.prepare('INSERT INTO attempts (attempt_id,session_id,provider_thread_id,provider_turn_id,provider_item_id,provider_process_id,workspace_set_json,created_at) VALUES (?,?,NULL,NULL,NULL,NULL,?,?)').run(aid,sid,'[]',new Date().toISOString());db.db.prepare("INSERT INTO capacity_slots VALUES (?, 'local', 'sibling', 'active', NULL)").run(aid);
 assert.equal(db.listEmployees().length,1);assert.equal(db.environments().find(e=>e.environment_id==='sibling')?.capacity.occupied,2);
 db.setCapacityCeiling('local',0);assert.equal(db.hostCapacity('local').occupied,2);assert.equal(db.executionDetail(String(attempt.attempt_id)).lease_state,'active');db.close();
});
test('remote bindings, board identity, approval waits and completed history persist',()=>{
 const {db,employee,task,input}=setup();db.createRemoteEnvironment('Coder fixture');const env=db.environments().find(e=>e.kind==='coder')!;db.bindEnvironment(employee.employee_id,env.environment_id);
 assert.throws(()=>db.startExecution(input),{code:'REMOTE_UNAVAILABLE'});assert.match(db.taskBoard()[0].blocking_reason,/Coder not connected/);
 db.bindEnvironment(employee.employee_id,'local');db.measureHost('local',null);assert.throws(()=>db.startExecution(input),{code:'WAITING_FOR_CAPACITY'});assert.equal(db.taskBoard()[0].working_state,'waiting for capacity');
 db.createPlan({project_id:String(task.project_id),task_id:task.task_id,summary:'Changed scope'});assert.match(db.taskBoard()[0].blocking_reason,/approval/);
 db.completeTask(task.task_id);assert.equal(db.taskBoard()[0].employee_id,employee.employee_id);assert.equal(db.taskBoard()[0].working_state,'complete');db.close();
});
