import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixelDatabase } from '../src/database.js';

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'pixel-decisions-')), db=new PixelDatabase(join(root,'state.sqlite'));
  db.measureHost('local',{cpu:8,total:32*2**30,available:24*2**30,measured_at:Date.now(),source:'fixture'});
  const paths=[join(root,'one'),join(root,'two')]; paths.forEach(path=>mkdirSync(path));
  const project=db.createProject('Decisions'), folders=paths.map(path=>db.attachFolder(project.project_id,realpathSync(path),path)), firstEmployee=db.createEmployee({name:'Mina'}), secondEmployee=db.createEmployee({name:'Rae'});
  const task=(title:string,employee_id:string)=>db.createTask({project_id:project.project_id,title,employee_id,folder_ids:folders.map(folder=>folder.folder_id),primary_folder_id:folders[0].folder_id});
  return {root,db,project,paths,first:task('Implement approved UI',firstEmployee.employee_id),second:task('Independent cleanup',secondEmployee.employee_id),firstEmployee,secondEmployee};
}

test('UI meeting revision preserves immutable versions and rejects stale approval',()=>{
  const {db,project,first,firstEmployee}=fixture();
  const meeting=db.createDecision({project_id:project.project_id,employee_id:firstEmployee.employee_id,kind:'ui',title:'Choose task card',recommendation:'Use the quiet card.',options:[{name:'Quiet',tradeoff:'Less decoration',preview:'moss'},{name:'Dense',tradeoff:'More scanning',preview:'clay'}],affected_task_ids:[first.task_id],gated_task_ids:[first.task_id]});
  assert.equal(meeting.current_version,1); const request=db.listInbox('pending')[0]; assert.equal(request.decision_version,1); assert.throws(()=>db.resolveRequest(String(request.request_id)),{code:'DECISION_APPROVAL_REQUIRED'}); assert.throws(()=>db.answerRequest(String(request.request_id),'Looks good'),{code:'DECISION_APPROVAL_REQUIRED'});
  const revised=db.reviseDecision(meeting.decision_id,{expected_version:1,feedback:'Make status more legible.',recommendation:'Use quiet with a stronger status line.',options:[{name:'Quiet+',tradeoff:'One extra line',preview:'moss'},{name:'Dense',tradeoff:'Still busy',preview:'clay'}],affected_task_ids:[first.task_id],gated_task_ids:[first.task_id]});
  assert.equal(revised.versions[1].status,'superseded'); assert.throws(()=>db.approveDecision(meeting.decision_id,{version:1}),{code:'STALE_DECISION_VERSION'});
  const approved=db.approveDecision(meeting.decision_id,{version:2,approved_by:'Hunter'}); assert.equal(approved.current.status,'approved'); assert.equal(approved.current.approved_by,'Hunter'); assert.equal(db.listInbox('pending').length,0); db.close();
});

test('technical approval gates only linked work and becomes project guidance',()=>{
  const {db,project,paths,first,second,firstEmployee,secondEmployee}=fixture();
  const meeting=db.createDecision({project_id:project.project_id,kind:'technical',title:'Select cache boundary',recommendation:'Cache within the service.',options:[{name:'Service',tradeoff:'Local ownership'},{name:'Browser',tradeoff:'Simpler service'}],affected_task_ids:[first.task_id,second.task_id],gated_task_ids:[first.task_id]});
  assert.throws(()=>db.startExecution({task_id:first.task_id,employee_id:firstEmployee.employee_id,purpose:'blocked',workspace_set:paths}),{code:'DECISION_APPROVAL_REQUIRED'});
  const independent=db.startExecution({task_id:second.task_id,employee_id:secondEmployee.employee_id,purpose:'continue',workspace_set:paths}); assert.ok(independent.attempt_id); db.releaseExecution(String(independent.attempt_id),'fixture');
  db.approveDecision(meeting.decision_id,{version:1,approved_by:'Hunter'});
  const guidance=db.guidanceForTask(project.project_id,second.task_id).find((item:any)=>item.provenance===`decision:${meeting.decision_id}:v1`); assert.match(String(guidance?.content),/Cache within the service/);
  const reopened=db.reviseDecision(meeting.decision_id,{expected_version:1,feedback:'Material load change.',recommendation:'Cache in SQLite.',options:[{name:'SQLite',tradeoff:'Durable'},{name:'Memory',tradeoff:'Transient'}],affected_task_ids:[first.task_id],gated_task_ids:[first.task_id]}); assert.equal(reopened.status,'pending'); assert.throws(()=>db.startExecution({task_id:first.task_id,employee_id:firstEmployee.employee_id,purpose:'blocked again',workspace_set:paths}),{code:'DECISION_APPROVAL_REQUIRED'}); db.close();
});

test('pending meeting and gate survive reload without timeout approval',()=>{
  const {root,db,project,first}=fixture(); const meeting=db.createDecision({project_id:project.project_id,kind:'ui',title:'Persistent preview',recommendation:'Option A',options:[{name:'A',tradeoff:'Calm'},{name:'B',tradeoff:'Dense'}],gated_task_ids:[first.task_id]}); db.close();
  const reopened=new PixelDatabase(join(root,'state.sqlite')); const restored=reopened.decisionDetail(meeting.decision_id)!; assert.equal(restored.status,'pending'); assert.equal(restored.current.status,'current'); assert.equal(reopened.pendingDecisionForTask(first.task_id)?.decision_id,meeting.decision_id); reopened.close();
});

