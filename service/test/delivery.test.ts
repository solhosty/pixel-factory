import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixelDatabase } from '../src/database.js';
import { executeDelivery } from '../src/delivery.js';

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'delivery-proof-')), one=join(root,'one'), two=join(root,'two'); mkdirSync(one);mkdirSync(two);writeFileSync(join(one,'a.txt'),'one');writeFileSync(join(two,'b.txt'),'two');
  const db=new PixelDatabase(join(root,'state.sqlite')),project=db.createProject('Delivery project'),a=db.attachFolder(project.project_id,one,one),b=db.attachFolder(project.project_id,two,two),employee=db.createEmployee({name:'Mina',character_id:'studio-character-01'}),task=db.createTask({project_id:project.project_id,title:'Ship it',employee_id:employee.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id});
  db.saveDemoRecipe(task.task_id,{start_command:'npm run dev',readiness_command:'ready',cleanup_command:'stop',ports:[5173]});const evidence=db.recordDemoEvidence(task.task_id,{checks:[{command:'npm test',result:'pass',passed:true}]});db.acceptDemoEvidence(task.task_id,evidence.evidence[0].evidence_id);
  return {db,project,task,a,b,first:one,second:two};
}

test('delivery defaults, task overrides, partial retry, and project completion stay distinct',()=>{
  const {db,project,task,a,b}=fixture();
  db.updateDelivery(project.project_id,{delivery_mode:'branch',default_branch:'main',notes:'Review before merge.'});
  db.setTaskDelivery(task.task_id,{delivery_mode:'pull_request',destination:'origin/release'});
  const first=db.beginDelivery(task.task_id); assert.equal(first.mode,'pull_request');
  db.recordDeliveryOutcome(task.task_id,{delivery_attempt_id:first.delivery_attempt_id,folder_id:a.folder_id,status:'delivered',destination:'https://example.test/pr/1'});
  const partial=db.recordDeliveryOutcome(task.task_id,{delivery_attempt_id:first.delivery_attempt_id,folder_id:b.folder_id,status:'failed',detail:'provider unavailable'});assert.equal(partial.status,'partial');
  const retry=db.beginDelivery(task.task_id);assert.equal(retry.delivery_attempt_id,first.delivery_attempt_id);assert.equal(retry.outcomes.find((item:any)=>item.folder_id===a.folder_id).status,'delivered');
  const delivered=db.recordDeliveryOutcome(task.task_id,{delivery_attempt_id:retry.delivery_attempt_id,folder_id:b.folder_id,status:'delivered',destination:'https://example.test/pr/2'});assert.equal(delivered.status,'delivered');assert.equal(db.projectDetail(project.project_id).release.state,'delivered');
  assert.throws(()=>db.setProjectStatus(project.project_id,'archived'),{code:'PROJECT_COMPLETION_REQUIRED'});db.markProjectDone(project.project_id);assert.equal(db.projectDetail(project.project_id).release.state,'done');db.setProjectStatus(project.project_id,'archived');assert.equal(db.getProject(project.project_id)?.status,'archived');db.close();
});

test('delivery requires accepted demo evidence and does not duplicate a successful outcome',()=>{
  const {db,project,task,a}=fixture();db.updateDelivery(project.project_id,{delivery_mode:'local'});
  const attempt=db.beginDelivery(task.task_id);db.recordDeliveryOutcome(task.task_id,{delivery_attempt_id:attempt.delivery_attempt_id,folder_id:a.folder_id,status:'delivered',destination:'local commit abc'});
  const retry=db.beginDelivery(task.task_id);assert.equal(retry.outcomes.find((item:any)=>item.folder_id===a.folder_id).destination,'local commit abc');db.close();
});

test('delivery uses the clean pre-execution baseline rather than treating completed work as pre-existing dirt',()=>{
  const {db,project,task,a,b,first,second}=fixture();
  const git=(args:string[])=>execFileSync('git',['-C',first,...args],{encoding:'utf8'}).trim();
  git(['init','-b','main']);git(['config','user.email','pixel@example.test']);git(['config','user.name','Pixel']);git(['add','a.txt']);git(['commit','-m','baseline']);
  db.measureHost('local',{cpu:8,total:32*2**30,available:24*2**30,measured_at:Date.now(),source:'fixture'});
  const employee=(task.assignments[0] as any).employee_id;
  const started=db.startExecution({task_id:task.task_id,employee_id:employee,purpose:'Create the reviewed change.',workspace_set:[first,second]});
  db.releaseExecution(started.attempt_id,'rehearsal_complete','released');
  db.updateDelivery(project.project_id,{delivery_mode:'branch',default_branch:'main'});
  writeFileSync(join(first,'a.txt'),'changed after execution began\n');
  const attempt=db.beginDelivery(task.task_id);
  assert.equal(JSON.parse(attempt.outcomes.find((item:any)=>item.folder_id===a.folder_id).baseline_json).status,'');
  db.close();
});

test('pull-request retry reuses a pushed isolated branch and existing provider PR without a duplicate commit', async () => {
  const root=mkdtempSync(join(tmpdir(),'delivery-pr-proof-')),repo=join(root,'repo'),remote=join(root,'remote.git');mkdirSync(repo);
  const git=(args:string[])=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  execFileSync('git',['init','--bare',remote]);git(['init','-b','main']);git(['config','user.email','pixel@example.test']);git(['config','user.name','Pixel']);writeFileSync(join(repo,'a.txt'),'base\n');git(['add','a.txt']);git(['commit','-m','base']);git(['remote','add','origin',remote]);git(['push','-u','origin','main']);
  const db=new PixelDatabase(join(root,'state.sqlite')),project=db.createProject('PR delivery'),folder=db.attachFolder(project.project_id,repo,repo),employee=db.createEmployee({name:'Mina',character_id:'studio-character-01'}),task=db.createTask({project_id:project.project_id,title:'Open a PR',employee_id:employee.employee_id,folder_ids:[folder.folder_id],primary_folder_id:folder.folder_id});
  db.updateDelivery(project.project_id,{delivery_mode:'pull_request',default_branch:'main'});db.saveDemoRecipe(task.task_id,{start_command:'npm run dev',readiness_command:'ready',cleanup_command:'stop',ports:[5173]});const evidence=db.recordDemoEvidence(task.task_id,{checks:[{command:'npm test',result:'pass',passed:true}]});db.acceptDemoEvidence(task.task_id,evidence.evidence[0].evidence_id);db.beginDelivery(task.task_id);writeFileSync(join(repo,'a.txt'),'changed\n');
  let createCalls=0, viewCalls=0;
  const gh=async (_path:string,args:string[])=>{if(args[1]==='view'){viewCalls++;if(viewCalls===1)throw new Error('no PR');return JSON.stringify({url:'https://example.test/pr/1'});}if(args[1]==='create'){createCalls++;throw new Error('provider timeout');}throw new Error('unexpected gh command');};
  const first=await executeDelivery(db,task.task_id,true,{gh});assert.equal(first.attempts[0].status,'failed');const branch=git(['branch','--show-current']);assert.match(branch,/^pixel-harness\//);assert.equal(git(['rev-list','--count','main..HEAD']),'1');
  const second=await executeDelivery(db,task.task_id,true,{gh});assert.equal(second.attempts[0].status,'delivered');assert.equal(second.attempts[0].outcomes[0].destination,'https://example.test/pr/1');assert.equal(createCalls,1);assert.equal(git(['rev-list','--count','main..HEAD']),'1');db.close();
});
