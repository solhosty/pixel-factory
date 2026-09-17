import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixelDatabase } from '../src/database.js';

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'employees-')), first=join(root,'one'), second=join(root,'two');mkdirSync(first);mkdirSync(second);
  const db=new PixelDatabase(join(root,'state.sqlite'));db.measureHost('local',{cpu:8,total:32*2**30,available:24*2**30,measured_at:Date.now(),source:'fixture'});
  const project=db.createProject('Company work'), a=db.attachFolder(project.project_id,first,first), b=db.attachFolder(project.project_id,second,second);
  return {db,project,a,b,first,second};
}

test('seven fixed repeatable positions do not silently attach skills',()=>{
  const {db}=fixture(),catalog=db.staffCatalog();
  assert.deepEqual(catalog.positions.map((position:any)=>position.name),['Designer','Frontend Engineer','Backend Engineer','Fullstack Engineer','Security Engineer','Project Manager','Marketing']);
  assert.ok(catalog.positions.every((position:any)=>position.default_skills.length===0));
  const first=db.createEmployee({name:'One',position_id:'designer',character_id:'studio-character-01'}), second=db.createEmployee({name:'Two',position_id:'designer',character_id:'studio-character-02'}), third=db.createEmployee({name:'Three',position_id:'security-engineer',character_id:'studio-character-03'});
  assert.equal(first.title,'Designer');assert.equal(second.position_id,'designer');assert.equal(third.title,'Security Engineer');db.close();
});

test('one active employee owns a predefined identity and deactivation releases it',()=>{
  const {db}=fixture(),first=db.createEmployee({name:'One',character_id:'studio-character-01'});
  assert.throws(()=>db.createEmployee({name:'Duplicate',character_id:'studio-character-01'}),{code:'CHARACTER_IDENTITY_IN_USE'});
  db.updateEmployee(first.employee_id,{active:false});
  assert.equal(db.createEmployee({name:'Reused',character_id:'studio-character-01'}).character_id,'studio-character-01');db.close();
});

test('session retains resolved skill and guidance snapshot after profile changes',()=>{
  const {db,project,a,b,first,second}=fixture();
  const employee=db.createEmployee({name:'Mina',position_id:'frontend-engineer',character_id:'studio-character-01'});
  const profile=db.addEmployeeSkill(employee.employee_id,{name:'Design systems review',instructions:'Check component states against the approved reference.'});
  const custom=profile.skills.find((skill:any)=>skill.name==='Design systems review');
  db.addGuidance({project_id:project.project_id,content:'Keep provenance visible.',provenance:'test'});
  const task=db.createTask({project_id:project.project_id,title:'Ship UI',employee_id:employee.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id});
  const started=db.startExecution({task_id:task.task_id,employee_id:employee.employee_id,purpose:'Implement only the approved UI.',workspace_set:[first,second]});
  assert.deepEqual(started.resolved_context.skills.map((skill:any)=>skill.name),['Design systems review']);
  assert.equal(started.resolved_context.project_guidance[0].content,'Keep provenance visible.');
  assert.equal(started.resolved_context.task_instructions,'Implement only the approved UI.');
  assert.match(started.resolved_context.capability_note,/permissions/);
  db.setEmployeeSkill(employee.employee_id,custom.skill_id,false);db.updateEmployee(employee.employee_id,{position_id:'marketing'});
  const retained=db.executionDetail(started.attempt_id).resolved_context;
  assert.equal(retained.position.name,'Frontend Engineer');assert.ok(retained.skills.some((skill:any)=>skill.name==='Design systems review'));db.close();
});

test('six complete identities bound the active roster without changing eight-desk or worker capacity',()=>{
  const {db}=fixture(),catalog=db.staffCatalog();assert.equal(catalog.characters.length,6);assert.ok(catalog.characters.every((item:any)=>item.ready&&item.appearance_recipe?.hair));
  for(let index=0;index<6;index++)db.createEmployee({name:`Person ${index+1}`,character_id:`studio-character-${String(index+1).padStart(2,'0')}`});
  assert.throws(()=>db.createEmployee({name:'Seventh'}),{code:'STUDIO_CAPACITY_REACHED'});
  assert.throws(()=>db.createEmployee({name:'Unfinished identity',character_id:'studio-character-07'}),{code:'CHARACTER_IDENTITY_UNAVAILABLE'});
  assert.equal(db.hostCapacity('local').effective_limit,1);db.close();
});
