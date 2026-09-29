import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PixelDatabase } from '../src/database.js';

test('a task thread preserves its objective, ordered rich context, explicit team agreement, and plan gate', () => {
  const root=mkdtempSync(join(tmpdir(),'pixel-thread-')), db=new PixelDatabase(join(root,'state.sqlite'));
  const project=db.createProject('Threaded work'), folderPath=join(root,'repo'); mkdirSync(folderPath);
  const folder=db.attachFolder(project.project_id,folderPath,folderPath), employee=db.createEmployee({name:'Mina'});
  const task=db.createTask({project_id:project.project_id,title:'Make the review readable',brief_text:'Make the review readable without changing delivery.',employee_id:employee.employee_id,folder_ids:[folder.folder_id],primary_folder_id:folder.folder_id,inputs:[
    {input_id:'image',kind:'image',label:'review.png',mime_type:'image/png',content_base64:'aW1hZ2U=',provenance:'browser file attachment'},
    {input_id:'text',kind:'file',label:'notes.md',mime_type:'text/markdown',content_base64:'bm90ZXM=',provenance:'browser file attachment'}
  ]});
  db.addTaskThreadMessage(task.task_id,{body:'Keep the toolbar compact.'});
  db.addTaskThreadMessage(task.task_id,{body:'Use one clear approval state across the project.',save_as_team_agreement:true});
  const plan=db.createPlan({project_id:project.project_id,task_id:task.task_id,summary:'Present a compact review thread.'});
  const thread=db.taskThread(task.task_id)!;
  assert.equal(thread.thread.entries[0].kind,'objective');
  assert.deepEqual(thread.inputs.map((input:any)=>input.input_id),['image','text']);
  assert.equal(thread.thread.team_agreements.length,1);
  assert.match(thread.thread.team_agreements[0].provenance,/^team-agreement:/);
  assert.match(thread.thread.waiting_on,/approve a plan/i);
  db.approvePlan(plan.plan_id,'Hunter');
  assert.match(db.taskThread(task.task_id)!.thread.entries.at(-1).body,/approved by Hunter/);
  assert.equal(db.taskThread(task.task_id)!.thread.waiting_on,null);
  db.close();
});

test('task thread reads immutable decision and inbox records without changing their approval rules', () => {
  const root=mkdtempSync(join(tmpdir(),'pixel-thread-decision-')), db=new PixelDatabase(join(root,'state.sqlite'));
  const project=db.createProject('Decision thread'), folderPath=join(root,'repo'); mkdirSync(folderPath);
  const folder=db.attachFolder(project.project_id,folderPath,folderPath), employee=db.createEmployee({name:'Mina'});
  const task=db.createTask({project_id:project.project_id,title:'Choose a layout',employee_id:employee.employee_id,folder_ids:[folder.folder_id],primary_folder_id:folder.folder_id});
  const decision=db.createDecision({project_id:project.project_id,employee_id:employee.employee_id,kind:'ui',title:'Review layout',recommendation:'Use the focused layout.',options:[{name:'Focused',tradeoff:'Less density'},{name:'Dense',tradeoff:'Less breathing room'}],affected_task_ids:[task.task_id],gated_task_ids:[task.task_id]});
  const thread=db.taskThread(task.task_id)!;
  assert.equal(thread.thread.decisions[0].decision_id,decision.decision_id);
  assert.equal(thread.thread.requests[0].decision_id,decision.decision_id);
  assert.match(thread.thread.entries.at(-1).body,/Decision requested/);
  assert.throws(()=>db.resolveRequest(thread.thread.requests[0].request_id),{code:'DECISION_APPROVAL_REQUIRED'});
  db.close();
});

test('thread lifecycle keeps decision revisions, approvals, and board recency on the same task', () => {
  const root=mkdtempSync(join(tmpdir(),'pixel-thread-lifecycle-')), db=new PixelDatabase(join(root,'state.sqlite'));
  const project=db.createProject('Lifecycle thread'), folderPath=join(root,'repo'); mkdirSync(folderPath);
  const folder=db.attachFolder(project.project_id,folderPath,folderPath), employee=db.createEmployee({name:'Mina'});
  const task=db.createTask({project_id:project.project_id,title:'Choose the review state',employee_id:employee.employee_id,folder_ids:[folder.folder_id],primary_folder_id:folder.folder_id});
  const plan=db.createPlan({project_id:project.project_id,task_id:task.task_id,summary:'Present the focused review state'});
  assert.match(db.taskThread(task.task_id)!.thread.entries.at(-1).body,/Plan version 1 proposed/);
  db.approvePlan(plan.plan_id,'Hunter');
  const decision=db.createDecision({project_id:project.project_id,employee_id:employee.employee_id,kind:'ui',title:'Review density',recommendation:'Use focused spacing.',options:[{name:'Focused',tradeoff:'Less density'},{name:'Dense',tradeoff:'More scanning'}],affected_task_ids:[task.task_id],gated_task_ids:[task.task_id]});
  const revised=db.reviseDecision(decision.decision_id,{expected_version:1,feedback:'Keep the row status visible.',recommendation:'Use focused spacing with status.',options:[{name:'Focused',tradeoff:'Less density'},{name:'Dense',tradeoff:'More scanning'}],affected_task_ids:[task.task_id],gated_task_ids:[task.task_id]});
  assert.equal(revised.current_version,2);
  assert.match(db.taskThread(task.task_id)!.thread.entries.at(-1).body,/Decision revised.*version 2/);
  db.approveDecision(decision.decision_id,{version:2,approved_by:'Hunter'});
  const thread=db.taskThread(task.task_id)!;
  assert.match(thread.thread.entries.at(-1).body,/Decision Review density version 2 approved by Hunter/);
  const board=db.taskBoard().find((item:any)=>item.task_id===task.task_id)!;
  assert.match(board.last_meaningful_update.summary,/approved by Hunter/);
  assert.ok(board.last_meaningful_update.at);
  db.close();
});

test('persisted acceptance fixture survives service restart with ordered context and its exact pending request', () => {
  const root=mkdtempSync(join(tmpdir(),'pixel-thread-persisted-')), state=join(root,'state.sqlite'), db=new PixelDatabase(state);
  const project=db.createProject('3F persisted fixture'), folderPath=join(root,'repo'); mkdirSync(folderPath);
  const folder=db.attachFolder(project.project_id,folderPath,folderPath), employee=db.createEmployee({name:'Mina'});
  const task=db.createTask({project_id:project.project_id,title:'Explain the review state',brief_text:'Explain the review state in one clear sentence.',employee_id:employee.employee_id,folder_ids:[folder.folder_id],primary_folder_id:folder.folder_id,inputs:[
    {input_id:'fixture-image',kind:'image',label:'review.png',mime_type:'image/png',content_base64:'aW1hZ2U=',provenance:'fixture attachment'},
    {input_id:'fixture-text',kind:'file',label:'notes.md',mime_type:'text/markdown',content_base64:'bm90ZXM=',provenance:'fixture attachment'}
  ]});
  db.createPlan({project_id:project.project_id,task_id:task.task_id,summary:'Present the review state.'});
  const decision=db.createDecision({project_id:project.project_id,employee_id:employee.employee_id,kind:'ui',title:'Choose review density',recommendation:'Use focused spacing.',options:[{name:'Focused',tradeoff:'Less density'},{name:'Dense',tradeoff:'More scanning'}],affected_task_ids:[task.task_id],gated_task_ids:[task.task_id]});
  db.close();
  const reopened=new PixelDatabase(state), thread=reopened.taskThread(task.task_id)!;
  assert.deepEqual(thread.inputs.map((input:any)=>input.input_id),['fixture-image','fixture-text']);
  assert.equal(thread.thread.requests.filter((request:any)=>request.status==='pending')[0].decision_id,decision.decision_id);
  assert.equal(reopened.taskBoard()[0].task_id,task.task_id);
  reopened.close();
});

test('one employee can retain two task workspaces while capacity queues the second session', () => {
  const root=mkdtempSync(join(tmpdir(),'pixel-3g-')), db=new PixelDatabase(join(root,'state.sqlite'));
  db.measureHost('local',{cpu:8,total:16*1024**3,available:16*1024**3,measured_at:Date.now(),source:'deterministic test capacity sample'});
  const project=db.createProject('Two task fixture'), one=join(root,'one'), two=join(root,'two'), three=join(root,'three'); mkdirSync(one);mkdirSync(two);mkdirSync(three);
  const firstFolder=db.attachFolder(project.project_id,one,one), secondFolder=db.attachFolder(project.project_id,two,two), thirdFolder=db.attachFolder(project.project_id,three,three), employee=db.createEmployee({name:'Mina'});
  const first=db.createTask({project_id:project.project_id,title:'First workspace',employee_id:employee.employee_id,folder_ids:[firstFolder.folder_id,secondFolder.folder_id],primary_folder_id:firstFolder.folder_id});
  const second=db.createTask({project_id:project.project_id,title:'Second workspace',employee_id:employee.employee_id,folder_ids:[thirdFolder.folder_id,secondFolder.folder_id],primary_folder_id:thirdFolder.folder_id});
  const firstPlan=db.createPlan({project_id:project.project_id,task_id:first.task_id,summary:'First plan'}), secondPlan=db.createPlan({project_id:project.project_id,task_id:second.task_id,summary:'Second plan'});db.approvePlan(firstPlan.plan_id,'Hunter');db.approvePlan(secondPlan.plan_id,'Hunter');
  const started=db.startExecution({task_id:first.task_id,employee_id:employee.employee_id,purpose:'First task',workspace_set:[one,two]});
  assert.throws(()=>db.startExecution({task_id:second.task_id,employee_id:employee.employee_id,purpose:'Second task',workspace_set:[three,two]}),{code:'WAITING_FOR_CAPACITY'});
  assert.equal(db.employeeDetail(employee.employee_id)?.active_assignments.length,2);assert.equal(db.taskThread(first.task_id)?.task_id,first.task_id);assert.equal(db.taskThread(second.task_id)?.task_id,second.task_id);assert.equal(db.taskBoard().find((task:any)=>task.task_id===second.task_id)?.working_state,'waiting for capacity');
  db.releaseExecution(started.attempt_id,'fixture');db.reconcileCapacity(started.attempt_id);db.cancelTask(second.task_id);assert.equal(db.taskBoard().find((task:any)=>task.task_id===second.task_id)?.working_state,'cancelled');db.reopenTask(second.task_id);assert.equal(db.taskDetail(second.task_id)?.assignments[0]?.employee_id,employee.employee_id);db.close();
});
