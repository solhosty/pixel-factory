import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixelDatabase } from '../src/database.js';

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'rich-task-')),one=join(root,'one'),two=join(root,'two');mkdirSync(one);mkdirSync(two);
  const db=new PixelDatabase(join(root,'state.sqlite'));const project=db.createProject('Rich work');
  const a=db.attachFolder(project.project_id,one,one),b=db.attachFolder(project.project_id,two,two);
  const first=db.createEmployee({name:'Mina',character_id:'studio-character-01'}),second=db.createEmployee({name:'Rae',character_id:'studio-character-02'});
  return {root,db,project,a,b,first,second};
}

test('rich task draft retains stable ordered inputs, assignment, and selected folders across reload',()=>{
  const {root,db,project,a,b,first}=fixture();
  const task=db.createTask({project_id:project.project_id,title:'Compose it',brief_text:'A durable brief',task_instructions:'Keep scope explicit.',employee_id:first.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id,inputs:[
    {input_id:'input-image',kind:'image',label:'reference.png',mime_type:'image/png',content_base64:'iVBORw0KGgo=',provenance:'browser file attachment'},
    {input_id:'input-file',kind:'file',label:'notes.txt',mime_type:'text/plain',content_base64:'bm90ZXM=',provenance:'browser file attachment'},
    {input_id:'input-project',kind:'project',label:'Rich work',referenced_id:project.project_id,provenance:'tagged project context'}
  ]});
  assert.deepEqual(task.inputs.map((item:any)=>item.input_id),['input-image','input-file','input-project']);assert.equal(task.assignments[0].employee_id,first.employee_id);db.close();
  const reopened=new PixelDatabase(join(root,'state.sqlite')),retained=reopened.taskDetail(task.task_id)!;assert.equal(retained.brief_text,'A durable brief');assert.deepEqual(retained.inputs.map((item:any)=>item.input_id),['input-image','input-file','input-project']);assert.deepEqual(retained.folders.map((item:any)=>item.folder_id),[a.folder_id,b.folder_id]);reopened.close();
});

test('assignment changes preserve task history while an employee can own multiple active tasks',()=>{
  const {db,project,a,b,first,second}=fixture();const task=db.createTask({project_id:project.project_id,title:'First',employee_id:first.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id});
  db.assignTask(task.task_id,second.employee_id);assert.equal(db.employeeDetail(first.employee_id)?.assignment,undefined);assert.equal(db.employeeDetail(second.employee_id)?.assignment?.task_id,task.task_id);
  const secondTask=db.createTask({project_id:project.project_id,title:'Second',employee_id:second.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id});
  assert.equal(db.employeeDetail(second.employee_id)?.active_assignments.length,2);assert.ok(db.employeeDetail(second.employee_id)?.active_assignments.some((assignment:any)=>assignment.task_id===secondTask.task_id));db.close();
});

test('missing referenced inputs fail visibly and resolved context snapshots all available inputs',()=>{
  const {root,db,project,a,b,first}=fixture(),source=join(root,'context.txt');writeFileSync(source,'context');
  const task=db.createTask({project_id:project.project_id,title:'Inputs',employee_id:first.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id,inputs:[{input_id:'ref',kind:'file-reference',label:'context.txt',source_path:source,provenance:'local reference'}]});
  assert.equal(task.inputs[0].availability,'available');db.replaceTaskInputs(task.task_id,[{input_id:'missing',kind:'file-reference',label:'gone.txt',source_path:join(root,'gone.txt'),provenance:'local reference'}]);assert.equal(db.refreshTaskInputs(task.task_id)!.inputs[0].availability,'unavailable');
  db.replaceTaskInputs(task.task_id,[{input_id:'paste',kind:'paste',label:'notes',mime_type:'text/plain',content_base64:'aGVsbG8=',provenance:'paste'},{input_id:'project',kind:'project',label:'Rich work',referenced_id:project.project_id,provenance:'tag'}]);const context=db.resolvedContext(first.employee_id,project.project_id,task.task_id,'Launch');assert.equal(context.task_inputs[0].input_id,'paste');assert.equal(context.task_inputs[0].content_base64,undefined);assert.equal(context.task_inputs[1].resolved_value.name,'Rich work');assert.equal(context.version,3);db.close();
});

test('one atomic draft save replaces all composer state and invalidates approved plan',()=>{
  const {db,project,a,b,first,second}=fixture();const task=db.createTask({project_id:project.project_id,title:'Before',employee_id:first.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id});
  const plan=db.createPlan({project_id:project.project_id,task_id:task.task_id,summary:'Approved plan'});db.approvePlan(plan.plan_id,'tester');
  const saved=db.saveTaskDraft(task.task_id,{title:'After',brief_text:'Saved together',task_instructions:'Use this.',employee_id:second.employee_id,folder_ids:[b.folder_id,a.folder_id],primary_folder_id:b.folder_id,inputs:[{input_id:'note',kind:'paste',label:'note',mime_type:'text/plain',content_base64:'aGk=',provenance:'test'}]});
  assert.equal(saved.title,'After');assert.equal(saved.assignments[0].employee_id,second.employee_id);assert.equal(saved.folders.find((folder:any)=>folder.is_primary)?.folder_id,b.folder_id);assert.equal(saved.inputs[0].input_id,'note');assert.equal(db.approvedPlanForTask(task.task_id),undefined);assert.equal(db.planDetail(plan.plan_id)?.status,'superseded');db.close();
});

test('invalid rich input cannot leave a partial task or busy assignment',()=>{
  const {db,project,a,b,first}=fixture();const before=db.taskBoard().length;
  assert.throws(()=>db.createTask({project_id:project.project_id,title:'Never committed',employee_id:first.employee_id,folder_ids:[a.folder_id,b.folder_id],primary_folder_id:a.folder_id,inputs:[{kind:'unknown'}]}),{code:'VALIDATION_ERROR'});
  assert.equal(db.taskBoard().length,before);assert.equal(db.employeeDetail(first.employee_id)?.assignment,undefined);db.close();
});
