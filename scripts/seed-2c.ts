import { PixelDatabase } from '../service/src/database.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GiB } from '../service/src/capacity.js';
const root=process.env.PIXEL_HARNESS_DATA_DIR;
if(!root || !root.startsWith('/private/tmp/')) throw new Error('Use a disposable /private/tmp directory');
const db=new PixelDatabase(join(root,'pixel-harness.sqlite'));
const ids:any={};
for(const name of ['Atlas fixture','Beacon fixture']){
 const p=db.createProject(name);const folders=['one','two'].map(n=>{const path=join(root,name,n);mkdirSync(path,{recursive:true});return db.attachFolder(p.project_id,path,path);});
 for(const [person,title,approved] of [[name.startsWith('Atlas')?'Mina local':'Theo local','Bounded capacity proof',true],['Remote fixture','Disconnected review',true],['Available later','Approval needed',false],['','Unassigned work',false]] as const){
 const emp=person?db.createEmployee({name:person,title:'Acceptance fixture'}):null;
 const task=db.createTask({project_id:p.project_id,title:`${name} · ${title}`,employee_id:emp?.employee_id,folder_ids:folders.map(f=>f.folder_id),primary_folder_id:folders[0].folder_id});
 const plan=db.createPlan({project_id:p.project_id,task_id:task.task_id,summary:'Bounded fixture plan',acceptance:['Reply only; do not inspect or modify files.']});if(approved)db.approvePlan(plan.plan_id,'2C acceptance');
 if(person==='Remote fixture'){db.createRemoteEnvironment(`${name} Coder fixture`);const env=db.environments().at(-1)!;db.db.prepare('UPDATE execution_environments SET fixture=1 WHERE environment_id=?').run(env.environment_id);db.bindEnvironment(emp!.employee_id,env.environment_id);}
 if(person==='Mina local') ids.real={task_id:task.task_id,employee_id:emp!.employee_id,plan_id:plan.plan_id};
 }
}
db.createEmployee({name:'Available coworker',title:'Unassigned fixture'});
for(const [name,cpu,available,age] of [['CPU limited',4,24,0],['Memory limited',32,8,0],['Stale data',8,24,60000],['Missing data',0,0,0]] as const){db.createRemoteEnvironment(`${name} fixture`);const env=db.environments().at(-1)!;db.db.prepare('UPDATE execution_environments SET fixture=1 WHERE environment_id=?').run(env.environment_id);db.measureHost(env.host_id,cpu?{cpu,total:32*GiB,available:available*GiB,measured_at:Date.now()-age,source:`${name} deterministic fixture`}:null);}
writeFileSync(join(root,'ids.json'),JSON.stringify(ids));db.close();console.log('Disposable acceptance fixtures created.');
