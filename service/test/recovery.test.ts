import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PixelDatabase } from '../src/database.js';
import { GiB } from '../src/capacity.js';

function setup() {
  const root=mkdtempSync(join(tmpdir(),'pixel-recovery-workspace-'));
  const second=mkdtempSync(join(tmpdir(),'pixel-recovery-second-'));
  writeFileSync(join(root,'work.txt'),'saved edit'); writeFileSync(join(second,'api.txt'),'saved api edit');
  const db=new PixelDatabase(join(mkdtempSync(join(tmpdir(),'pixel-recovery-db-')),'db.sqlite'));
  db.measureHost('local',{cpu:8,total:32*GiB,available:24*GiB,measured_at:Date.now(),source:'deterministic recovery fixture'});
  const project=db.createProject('Recovery fixture'), employee=db.createEmployee({name:'Ada'});
  const f1=db.attachFolder(project.project_id,root,root), f2=db.attachFolder(project.project_id,second,second);
  const task=db.createTask({project_id:project.project_id,title:'Recover safely',employee_id:employee.employee_id,folder_ids:[f1.folder_id,f2.folder_id],primary_folder_id:f1.folder_id});
  const plan=db.createPlan({project_id:project.project_id,task_id:task.task_id,summary:'Approved recovery plan'}); db.approvePlan(plan.plan_id,'fixture');
  return {db,root,project,employee,task,input:{task_id:task.task_id,employee_id:employee.employee_id,purpose:'Continue the approved task',workspace_set:[root,second]}};
}

test('office refresh and two tabs retain ownership until the final grace expiry',()=>{
  const {db}=setup(); db.heartbeatClient('tab-a'); db.heartbeatClient('tab-b');
  assert.equal(db.clientCount(),2); db.disconnectClient('tab-a'); assert.equal(db.clientCount(),1);
  db.heartbeatClient('tab-a-refresh'); assert.equal(db.clientCount(),2);
  db.expireClients(new Date(Date.now()+1000).toISOString()); assert.equal(db.clientCount(),0); db.close();
});

test('closure continuation preserves session identity and re-applies capacity once',()=>{
  const {db,input}=setup(); const first=db.startExecution(input); db.createContinuation(first.attempt_id,'last_client_disconnect'); db.releaseExecution(first.attempt_id,'last_client_disconnect'); db.reconcileCapacity(first.attempt_id);
  const continuation=db.continuations('eligible')[0]; const resumed=db.resumeContinuation(continuation.continuation_id);
  assert.equal(resumed.session_id,first.session_id); assert.notEqual(resumed.attempt_id,first.attempt_id);
  assert.equal(db.hostCapacity('local').occupied,1); assert.equal(db.continuations()[0].state,'eligible'); db.markContinuationResumed(continuation.continuation_id,resumed.attempt_id); assert.equal(db.continuations()[0].state,'resumed'); db.close();
});

test('workspace changes create reviewable recovery conflict',()=>{
  const {db,input,root}=setup(); const first=db.startExecution(input); db.createContinuation(first.attempt_id,'forced_interruption'); db.releaseExecution(first.attempt_id,'forced_interruption','lost'); db.reconcileCapacity(first.attempt_id);
  writeFileSync(join(root,'work.txt'),'changed outside Pixel'); const reviewed=db.reviewContinuation(db.continuations()[0].continuation_id) as any;
  assert.equal(reviewed.fingerprint_matches,false); assert.equal(reviewed.state,'blocked'); assert.equal(reviewed.reason,'workspace_changed'); db.close();
});

test('manual stop and project pause persist across reopen',()=>{
  const {db,input,project}=setup(); const first=db.startExecution(input); db.createContinuation(first.attempt_id,'office_close'); db.releaseExecution(first.attempt_id,'manual_session_stop'); db.reconcileCapacity(first.attempt_id); db.cancelContinuationsFor({task_id:input.task_id});
  assert.equal(db.continuations()[0].state,'cancelled'); assert.throws(()=>db.resumeContinuation(db.continuations()[0].continuation_id),{code:'RECOVERY_REVIEW_REQUIRED'});
  db.pauseProject(project.project_id,true); assert.equal(db.getProject(project.project_id)?.execution_state,'paused'); db.setOfficeState('closed'); db.setOfficeState('open'); assert.equal(db.getProject(project.project_id)?.execution_state,'paused'); db.close();
});

test('reused unrelated PID is released without receiving a signal',()=>{
  const {db,input}=setup(); const attempt=db.startExecution(input); db.activateCapacity(attempt.attempt_id,process.pid,'fixture-owner-token');
  assert.doesNotThrow(()=>db.reconcileCapacity(attempt.attempt_id)); assert.equal(db.hostCapacity('local').occupied,0);
  assert.ok(db.executionDetail(attempt.attempt_id).events.some((event:any)=>event.kind==='attempt.pid_reuse_ignored')); db.close();
});
