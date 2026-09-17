import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixelDatabase } from '../src/database.js';

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'demo-proof-')), repo=join(root,'repo'); mkdirSync(repo); writeFileSync(join(repo,'proof.txt'),'one');
  const db=new PixelDatabase(join(root,'state.sqlite')), project=db.createProject('Demo project'), folder=db.attachFolder(project.project_id,repo,repo), employee=db.createEmployee({name:'Mina',character_id:'studio-character-01'});
  const task=db.createTask({project_id:project.project_id,title:'Review demo',employee_id:employee.employee_id,folder_ids:[folder.folder_id],primary_folder_id:folder.folder_id});
  return {db,task,repo};
}

test('demo recipes retain revision fingerprints, reject bad ports and stale evidence after workspace change',()=>{
  const {db,task,repo}=fixture();
  assert.throws(()=>db.saveDemoRecipe(task.task_id,{start_command:'npm run dev',readiness_command:'curl http://127.0.0.1:4173',cleanup_command:'stop',ports:[0]}),{code:'VALIDATION_ERROR'});
  db.saveDemoRecipe(task.task_id,{setup_commands:['npm ci'],start_command:'npm run dev',readiness_command:'curl http://127.0.0.1:4173',cleanup_command:'stop owned preview',ports:[4173],known_gaps:'Recording is optional.'});
  const saved=db.recordDemoEvidence(task.task_id,{checks:[{command:'npm test',result:'pass',passed:true}],preview_note:'Reviewed in the runnable preview.'});
  const evidence=saved.evidence[0]; assert.equal(evidence.status,'fresh'); db.acceptDemoEvidence(task.task_id,evidence.evidence_id,'reviewer');
  writeFileSync(join(repo,'proof.txt'),'two changed'); const stale=db.demoForTask(task.task_id)!;
  assert.equal(stale.evidence[0].status,'stale'); assert.match(stale.evidence[0].stale_reason,/fingerprint/); assert.throws(()=>db.acceptDemoEvidence(task.task_id,evidence.evidence_id),{code:'DEMO_EVIDENCE_STALE'}); db.close();
});

test('failed checks never become fresh evidence',()=>{
  const {db,task}=fixture(); db.saveDemoRecipe(task.task_id,{start_command:'npm run dev',readiness_command:'ready',cleanup_command:'stop',ports:[5173]});
  assert.throws(()=>db.recordDemoEvidence(task.task_id,{checks:[{command:'npm test',result:'failed',passed:false}]}),{code:'CHECK_FAILED'}); db.close();
});
