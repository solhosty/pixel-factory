<script lang="ts">
 import { onMount } from 'svelte';
 import { gridRoute, seatRoute, officeFloor, clearOfPeople } from './navigation';
 import { art } from './art';
 import Sprite from './Sprite.svelte';
 import StatusBubble from './StatusBubble.svelte';
 export let staff:any[]=[];
 export let reduced=false;
 export let selectedId:string|undefined;
 export let active=true;
 export let poseOverrides:Record<string,string>={};
 let tile=32;
 export let navigate:(panel:string,person?:any)=>void;
 let mapElement:HTMLDivElement;
 // The player starts facing the work area. Coworkers remain seated at desks.
 let x=11,y=13, direction=3,frame=0,moving=false,systemReduced=false, hint='Click the Studio floor to walk. Select a colleague to open their details.';
 let raf=0,lastTime=0,cycle=0,drawX=10,drawY=12;
 let segment:{fromX:number;fromY:number;toX:number;toY:number;elapsed:number}|null=null;
 let path:number[][]=[],held:string[]=[];
 const keys:Record<string,number[]>={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
 const stepMs=240;
 type Fixture={type:string,x:number,y:number,w:number,h:number,solid?:boolean,layer?:number};
 const workstations=[
  {fixture:{type:'desk',x:.8,y:5.15,w:6.6,h:4.95,layer:85},seat:{x:3.5,y:9.2,direction:3,pose:'north',layer:102}},
  {fixture:{type:'desk-east',x:16.25,y:5.25,w:2.5,h:4.6,layer:86},seat:{x:15.6,y:7.65,direction:2,pose:'east',layer:87}},
  {fixture:{type:'desk-west',x:2.8,y:11.8,w:2.8,h:5.15,layer:154},seat:{x:6,y:14.9,direction:1,pose:'west',layer:158}},
  {fixture:{type:'writing',x:10.55,y:9.3,w:5.05,h:4.95,layer:130},seat:{x:12.35,y:13.45,direction:3,pose:'north',layer:146}},
  {fixture:{type:'desk-east',x:21.05,y:5.25,w:2.35,h:4.6,layer:86},seat:{x:20.35,y:7.65,direction:2,pose:'east',layer:87}},
  {fixture:{type:'desk-east',x:21.05,y:11.35,w:2.35,h:4.6,layer:148},seat:{x:20.35,y:13.75,direction:2,pose:'east',layer:149}},
  {fixture:{type:'writing',x:10.55,y:15.1,w:5.05,h:4.65,layer:188},seat:{x:12.35,y:19.05,direction:3,pose:'north',layer:203}},
  {fixture:{type:'desk-west',x:3.5,y:16.25,w:2.8,h:4.5,layer:199},seat:{x:6.65,y:19.05,direction:1,pose:'west',layer:204}}
 ];
 const fixtures:Fixture[]=[
  ...workstations.map(station=>station.fixture),
  {type:'window',x:4.8,y:.35,w:5.5,h:4.25,solid:false,layer:42},
  {type:'bookcase',x:.65,y:.7,w:3.15,h:5.1,layer:55},
  {type:'notice',x:12.45,y:1.1,w:3.4,h:4.25,layer:53},
  {type:'wallShelf',x:16.4,y:.8,w:2.9,h:2.55,solid:false,layer:42},
  {type:'filing',x:22.45,y:2.9,w:1.25,h:2.75,layer:56},
  {type:'pendant',x:3.35,y:0,w:1.15,h:1.95,solid:false,layer:58},
  {type:'clock',x:13.15,y:.25,w:.8,h:.82,solid:false,layer:58},
  {type:'painting',x:10.4,y:.65,w:1.5,h:1.22,solid:false,layer:58},
  {type:'plant',x:.4,y:10.3,w:1.7,h:2.4},
  {type:'plant',x:9.5,y:3.95,w:1.35,h:1.95},
  {type:'plant',x:12.2,y:4.9,w:1.35,h:1.85},
  {type:'plant',x:18.1,y:17.3,w:1.9,h:2.75},
  {type:'plant',x:4.8,y:16.5,w:2.2,h:3.0},
  {type:'coffee',x:16.1,y:17.1,w:4.25,h:3.2},
  {type:'coat',x:8.25,y:17.8,w:1.7,h:3.35},
  {type:'cat',x:17.2,y:15.25,w:2.4,h:1.85,solid:false}
 ];
 const width=24, height=22;
 $: objects=fixtures;
 $: people=staff.filter(person=>person.active).slice(0,8);
 const staffSlots=workstations.map(station=>station.seat);
 type Coworker={person:any,x:number,y:number,direction:number,pose:string,layer:number,mode:string,desired:string,frame:number,route:number[][],destination:number,pause:number,slot:number};
 let actors:Coworker[]=[];
 $: actors=people.map((person,i)=>{
   const previous=actors.find(a=>a.person.employee_id===person.employee_id);
   const mode=poseOverrides[person.employee_id] || (i===1?'walking':i===2?'sleeping':'seated');
   if(previous&&previous.desired===mode)return {...previous,person};
   const slot=staffSlots[i];
   if(previous&&['walking','returning'].includes(previous.mode))return {...previous,person,desired:mode,mode:mode==='walking'?'walking':'returning',route:[],pause:0};
   return {person,...slot,mode,desired:mode,frame:0,route:[],destination:i*2,pause:0,slot:i};
 });
 const patrol=[[10,7],[11,16],[8,18],[8,11],[14,16],[18,12],[14,10],[11,6]];
 function animateCoworkers(dt:number){
   actors=actors.map(actor=>{
     if(!['walking','returning'].includes(actor.mode)||(noMotion&&actor.mode==='walking'))return {...actor,frame:2};
     const a={...actor};
     if(a.pause>0){a.pause-=dt;a.frame=2;return a;}
     if(!a.route.length){
      const seat=staffSlots[a.slot];
      const target=a.mode==='returning'?[Math.floor(seat.x),Math.floor(seat.y)]:patrol[a.destination%patrol.length];
      if(a.mode==='returning'&&Math.hypot(a.x-seat.x,a.y-seat.y)<.1)return {...a,...seat,mode:a.desired,frame:0};
      a.destination++;
      const occupied:[number,number][]=[[drawX,drawY],...(segment?[[segment.toX,segment.toY] as [number,number]]:[]),...actors.filter(other=>other!==actor).map(other=>[other.x,other.y] as [number,number])];
      const available=(x:number,y:number)=>walkable(x,y,a.slot)&&clearOfPeople([x,y],occupied);
      const route=a.mode==='returning'?seatRoute([a.x,a.y],[seat.x,seat.y],available):gridRoute([a.x,a.y],target as [number,number],available);
      if(route===null||!route.length){a.pause=500;return a;}
      if(noMotion&&a.mode==='returning')return {...a,...seat,mode:a.desired,frame:0,route:[]};
      a.route=route;
     }
     const target=a.route[0];
     if(!clearOfPeople(target as [number,number],[[drawX,drawY],...(segment?[[segment.toX,segment.toY] as [number,number]]:[]),...actors.filter(other=>other!==actor).flatMap(other=>[[other.x,other.y] as [number,number],...(other.slot<a.slot&&other.route.length?[other.route[0] as [number,number]]:[])])])){a.pause=400;a.frame=2;a.route=[];return a;}
     const dx=target[0]-a.x,dy=target[1]-a.y,dist=Math.hypot(dx,dy),speed=dt/460;
     a.direction=Math.abs(dx)>Math.abs(dy)?dx<0?1:2:dy<0?3:0;
     a.frame=Math.floor(performance.now()/130)%6;
     if(dist<=speed){a.x=target[0];a.y=target[1];a.route=a.route.slice(1);if(!a.route.length)a.pause=1800;}
     else{a.x+=dx/dist*speed;a.y+=dy/dist*speed;}
     a.layer=Math.floor((a.y+1)*10)+1;
     return a;
   });
 }
 const rugs=[{x:1.1,y:7.6,w:6.9,h:3.0,tone:'blue'},{x:8.7,y:7.15,w:5.1,h:4.5,tone:'moss'},{x:1.7,y:14.4,w:6.2,h:3.1,tone:'blue'},{x:11.2,y:11.9,w:5.9,h:3.5,tone:'moss'},{x:8,y:17.5,w:3.8,h:3.5,tone:'red'}];
 $: noMotion=reduced||systemReduced;
 function blocked(a:number,b:number,seat=-1){
  if(b<5||!officeFloor(a,b))return true;
  if(staffSlots.some((slot,i)=>i!==seat&&a===Math.floor(slot.x)&&b===Math.floor(slot.y)))return true;
  return objects.some(o=>o.type==='cat'?(b===Math.floor(o.y+o.h*.6)&&a>=Math.ceil(o.x)&&a<o.x+o.w):o.solid!==false&&a+.5>=o.x&&a+.5<o.x+o.w&&b+.5>=o.y+o.h*(o.type.includes('desk')||o.type==='writing'?.42:.66)&&b+.5<o.y+o.h-(o.type==='desk'||o.type==='writing'?.85:.25));
 }
 function walkable(a:number,b:number,seat=-1){return a>0&&b>0&&a<width-1&&b<height-1&&!blocked(a,b,seat);}
 function findPath(start:number[],goal:number[],seat=-1){return gridRoute(start as [number,number],goal as [number,number],(x,y)=>walkable(x,y,seat))||[];}
 function stop(){held=[];path=[];segment=null;drawX=x;drawY=y;moving=false;frame=0;cycle=0;}
 function camera(){
  const viewport=mapElement?.parentElement;if(!viewport)return;
  const px=(drawX+.5)*tile,py=(drawY+.5)*tile;
  const marginX=Math.min(140,viewport.clientWidth*.3),marginY=145;
  if(px<viewport.scrollLeft+marginX)viewport.scrollLeft=Math.max(0,px-marginX);
  else if(px>viewport.scrollLeft+viewport.clientWidth-marginX)viewport.scrollLeft=px-viewport.clientWidth+marginX;
  if(py<viewport.scrollTop+marginY)viewport.scrollTop=Math.max(0,py-marginY);
  else if(py>viewport.scrollTop+viewport.clientHeight-90)viewport.scrollTop=py-viewport.clientHeight+90;
 }
 onMount(()=>{
  const viewport=mapElement.parentElement!;
  const resize=new ResizeObserver(()=>{if(viewport.clientWidth){const compact=window.innerWidth<=1000;tile=compact?36:Math.min(viewport.clientWidth/24,viewport.clientHeight/22);requestAnimationFrame(()=>{if(compact)camera();else{viewport.scrollTop=0;viewport.scrollLeft=0;}});}});resize.observe(viewport);
  const media=matchMedia('(prefers-reduced-motion: reduce)');systemReduced=media.matches;
  const change=()=>{systemReduced=media.matches;stop();};media.addEventListener('change',change);
  const blur=()=>stop();window.addEventListener('blur',blur);
  function tick(time:number){const dt=Math.min(40,time-lastTime||16);lastTime=time;
   if(active){
    animateCoworkers(dt);
    if(!segment){const step=path[0];if(step){if(begin(step[0],step[1]))path.shift();}else if(held.length){const [dx,dy]=keys[held.at(-1)!];begin(x+dx,y+dy);}}
    if(segment){segment.elapsed+=dt;const t=noMotion?1:Math.min(1,segment.elapsed/stepMs);drawX=segment.fromX+(segment.toX-segment.fromX)*t;drawY=segment.fromY+(segment.toY-segment.fromY)*t;moving=!noMotion;
     if(!noMotion){cycle+=dt;frame=Math.floor(cycle/100)%6;}
     if(segment.elapsed>=stepMs){x=segment.toX;y=segment.toY;segment=null;if(!path.length&&!held.length){moving=false;frame=0;cycle=0;}}
     camera();
    }else{moving=false;frame=0;cycle=0;}
   }
   raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);resize.disconnect();media.removeEventListener('change',change);window.removeEventListener('blur',blur);};
 });
 $: if(noMotion) stop();
 $: if(!active){held=[];path=[];moving=false;frame=0;cycle=0;}
 function begin(a:number,b:number){
  if(!walkable(a,b)||!clearOfPeople([a,b],actors.flatMap(actor=>[[actor.x,actor.y] as [number,number],...(actor.route.length?[actor.route[0] as [number,number]]:[])])))return false;
  direction=a<x?1:a>x?2:b<y?3:0;segment={fromX:x,fromY:y,toX:a,toY:b,elapsed:0};return true;
 }
 function walk(a:number,b:number){
  held=[];path=[];if(!walkable(a,b)||!clearOfPeople([a,b],actors.map(actor=>[actor.x,actor.y] as [number,number])))return;
  const start=segment?[segment.toX,segment.toY]:[x,y];path=findPath(start,[a,b]);
  if(noMotion&&path.length){direction=a<x?1:a>x?2:b<y?3:0;x=a;y=b;drawX=x;drawY=y;path=[];segment=null;camera();}
 }
 function key(e:KeyboardEvent){const k=keys[e.key];if(k){e.preventDefault();if(!active||e.repeat)return;path=[];held=held.filter(key=>key!==e.key);held.push(e.key);if(!segment){const [dx,dy]=k;begin(x+dx,y+dy);}}else if(['p','r','i'].includes(e.key)){e.preventDefault();navigate(({p:'projects',r:'roster',i:'inbox'} as Record<string,string>)[e.key]);}}
 function release(e:KeyboardEvent){held=held.filter(key=>key!==e.key);}
 function click(e:MouseEvent){if(!active)return;mapElement.focus({preventScroll:true});const r=mapElement.getBoundingClientRect();walk(Math.floor((e.clientX-r.left)/tile),Math.floor((e.clientY-r.top)/tile));}

 function propClick(e:MouseEvent,type:string){
  const canvas=(e.currentTarget as HTMLElement).querySelector('canvas');
  const bounds=canvas?.getBoundingClientRect();
  const opaque=canvas&&bounds&&canvas.getContext('2d')!.getImageData(Math.max(0,Math.min(canvas.width-1,Math.floor((e.clientX-bounds.left)/bounds.width*canvas.width))),Math.max(0,Math.min(canvas.height-1,Math.floor((e.clientY-bounds.top)/bounds.height*canvas.height))),1,1).data[3]>100;
  e.stopPropagation();
  if(opaque&&(type.includes('desk')||type==='coffee'))navigate('projects');
  else if(opaque&&type==='notice')navigate('inbox');
  else if(opaque&&type==='bookcase')navigate('roster');
  else click(e);
 }

</script>
<svelte:window onkeyup={release}/>
<div class="viewport">
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="map" bind:this={mapElement} role="application" tabindex="0" aria-label="Company Studio map. Arrow keys walk; P projects, R roster, I inbox." onkeydown={key} onblur={()=>held=[]} onclick={click} style={`width:${width*tile}px;height:${height*tile}px;--tile:${tile}px;--floor:url('${art.floor}');--wall:url('${art.wall}')`}>
  <div class="floor-plane"></div><svg class="room-outline" viewBox="0 0 24 22" preserveAspectRatio="none" aria-hidden="true"><path d="M.16 .16H23.84V19.44H20.64V20.84H18.5V21.84H8V20.84H3.56V18.84H.16Z"/></svg><div class="back-wall"></div><div class="left-wall"></div><div class="right-wall"></div><div class="baseboard"></div>
  {#each rugs as rug}<div class={`rug ${rug.tone}`} style={`left:${rug.x*tile}px;top:${rug.y*tile}px;width:${rug.w*tile}px;height:${rug.h*tile}px`}><Sprite kind="rug"/></div>{/each}
  <div class="window-light" aria-hidden="true"></div>
  <div class="window-panes" aria-hidden="true"><i></i><i></i><i></i></div>
  {#each objects as o}<button class="prop" class:desk={o.type.includes('desk')||o.type==='writing'} aria-label={o.type==='notice'?'Mailbox':o.type.includes('desk')||o.type==='writing'?'Project desk':o.type} style={`left:${o.x*tile}px;top:${o.y*tile}px;width:${o.w*tile}px;height:${o.h*tile}px;z-index:${o.layer??Math.floor((o.y+o.h)*10)}`} onclick={(e)=>propClick(e,o.type)}><Sprite kind={o.type}/></button>{/each}
    <div class="pendant-light" aria-hidden="true"></div>
    {#each workstations as station}<div class="lamp-pool" style={`left:${(station.seat.x-2.2)*tile}px;top:${(station.fixture.y-.5)*tile}px`} aria-hidden="true"></div>{/each}
    {#each staffSlots as slot}<div class="station-chair" data-facing={slot.pose} style={`left:${(slot.x-.75)*tile}px;top:${(slot.y-.55)*tile}px;width:${1.65*tile}px;height:${1.75*tile}px;z-index:${slot.layer+(slot.pose==='north'?1:-1)}`}><Sprite kind={`chair-${slot.pose}`}/></div>{/each}
    {#each actors as actor (actor.person.employee_id)}
      <button class="person" class:selected={selectedId===actor.person.employee_id} data-mode={actor.mode} data-direction={actor.direction} data-frame={actor.frame} data-x={actor.x} data-y={actor.y} aria-label={`Talk to ${actor.person.name}, ${actor.mode} facing ${['south','west','east','north'][actor.direction]}`} style={`left:${(actor.x-.75)*tile}px;top:${(actor.y-1.7)*tile}px;width:${1.65*tile}px;height:${2.7*tile}px;z-index:${actor.layer}`} onclick={(e)=>{e.stopPropagation();navigate('roster',actor.person);}}>
        <Sprite character kind={actor.pose} mode={actor.mode==='returning'?'walking':actor.mode} direction={actor.direction} frame={actor.frame} recipe={actor.person.appearance_recipe}/>
        <span class="person-label">{actor.person.name}</span>
        {#if actor.mode==='sleeping'||selectedId===actor.person.employee_id||actor.person.assignment}<span class="status-bubble"><StatusBubble kind={actor.mode==='sleeping'?'sleep':selectedId===actor.person.employee_id?'talk':'work'} reduced={noMotion}/></span>{/if}
      </button>
    {/each}
  <div class="player" data-moving={moving} data-frame={frame} data-direction={direction} data-x={x} data-y={y} data-draw-x={drawX} data-draw-y={drawY} style={`left:${(drawX-.2)*tile}px;top:${(drawY-1.65)*tile}px;width:${1.5*tile}px;height:${2.65*tile}px;z-index:${Math.floor((drawY+1)*10)+1}`}>
    <Sprite character mode="walking" {direction} frame={moving?frame:2} recipe={{skin:'golden-01',hair:'short-auburn-03',top:'overshirt-moss-01'}}/>

  </div>
  <div class="ambient-shade" aria-hidden="true"></div>
</div></div>
<style>
.viewport{height:100%;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#5a4734 #17171d;background:#17171d}
.map{position:relative;margin:auto;isolation:isolate;image-rendering:pixelated;overflow:hidden;background:#503924}
.map{clip-path:polygon(0 0,100% 0,100% 88.4%,86% 88.4%,86% 95%,77% 95%,77% 100%,33% 100%,33% 95%,15% 95%,15% 86%,0 86%)}
.room-outline{position:absolute;inset:0;width:100%;height:100%;z-index:222;pointer-events:none;fill:none;stroke:#775132;stroke-width:.22;filter:drop-shadow(0 2px 1px #171419)}
.map:focus-visible{outline:2px solid #cdb47f;outline-offset:-2px}
.floor-plane{position:absolute;inset:0;background-image:url('/assets/studio-v3/floor.svg');background-size:calc(var(--tile)*7) calc(var(--tile)*5.6);filter:saturate(1.1) brightness(.79)}
.back-wall{position:absolute;inset:0 0 auto;height:calc(var(--tile)*4.9);background:#b1a08b url('/assets/office-v2/wall-cream.png') repeat;background-size:calc(var(--tile)*5) calc(var(--tile)*4.9);border:calc(var(--tile)*.22) solid #624129;border-bottom:calc(var(--tile)*.16) solid #3c2d23;box-shadow:inset 0 10px 14px #30242f55,0 10px 12px #251d2244}
.left-wall,.right-wall{position:absolute;top:0;bottom:0;width:calc(var(--tile)*.36);background:#493327;border:3px solid #785235;z-index:220;box-shadow:9px 0 12px #21191966}.right-wall{right:0;box-shadow:-9px 0 15px #21191966}.baseboard{position:absolute;bottom:0;left:0;right:0;height:calc(var(--tile)*.3);background:#65412a;border:3px solid #8d5d35;z-index:220}
.rug{position:absolute;z-index:1;opacity:.9;filter:brightness(.82) saturate(.68);box-shadow:3px 5px 4px #251e2444}.rug.blue{filter:hue-rotate(120deg) saturate(.35) brightness(.72)}.rug.red{filter:hue-rotate(305deg) saturate(.55) brightness(.76)}
.prop{position:absolute;border:0;padding:0;background:transparent;filter:drop-shadow(5px 10px 3px #251a2488);cursor:pointer}.prop:focus-visible{outline:2px dashed #f4d394;outline-offset:3px}.prop:hover{filter:drop-shadow(5px 10px 3px #251a2488) brightness(1.06)}
.person,.player{position:absolute;background:none;border:0;padding:0;filter:drop-shadow(3px 5px 2px #201c2355)}.person{cursor:pointer}.player{pointer-events:none}.person-label{position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);background:#252630;color:#eee4cb;padding:3px 7px;white-space:nowrap;font:11px monospace;opacity:0;border:1px solid #8d8064;z-index:2}.person:hover .person-label,.person:focus-visible .person-label{opacity:1}
.status-bubble{position:absolute;right:-27%;top:-29%;width:calc(var(--tile)*1.12);height:calc(var(--tile)*1.12);pointer-events:none}.station-chair{position:absolute;pointer-events:none;filter:drop-shadow(3px 5px 2px #201c2355)}
.window-light{position:absolute;left:calc(var(--tile)*5.05);top:calc(var(--tile)*4.2);width:calc(var(--tile)*4.9);height:calc(var(--tile)*8);background:linear-gradient(180deg,#ffcb7844,transparent);pointer-events:none;z-index:2;mix-blend-mode:screen}
.window-panes{position:absolute;left:calc(var(--tile)*5.05);top:calc(var(--tile)*4.2);width:calc(var(--tile)*4.9);height:calc(var(--tile)*7.5);display:flex;gap:calc(var(--tile)*.16);padding:0 calc(var(--tile)*.13);z-index:3;pointer-events:none;mask-image:linear-gradient(#000b 0%,#000 35%,#0007 75%,transparent)}.window-panes i{display:block;flex:1;background:linear-gradient(180deg,#ffd38b55 0%,#ffd38b66 31%,#79522a33 31%,#79522a33 34%,#ffce7b88 34%,#f3b35c77 67%,#79522a22 67%,#79522a22 70%,#efad5255 70%);border-top:calc(var(--tile)*.08) solid #a87b4922}
.pendant-light{position:absolute;left:calc(var(--tile)*2.35);top:calc(var(--tile)*1.5);width:calc(var(--tile)*3.2);height:calc(var(--tile)*3.7);z-index:40;pointer-events:none;background:radial-gradient(ellipse at 50% 0,#ffcd7788,transparent 72%);mix-blend-mode:screen}
.lamp-pool{position:absolute;width:calc(var(--tile)*4.7);height:calc(var(--tile)*5.2);background:radial-gradient(ellipse at 50% 25%,#ffce7188 0,#ffc06455 33%,#ffa13b22 58%,transparent 72%);mix-blend-mode:screen;pointer-events:none;z-index:3}
.ambient-shade{position:absolute;inset:0;pointer-events:none;z-index:210;background:radial-gradient(ellipse at 45% 40%,transparent 20%,#241b2428 65%,#15141d99 100%);box-shadow:inset 0 0 25px #18151b88}
:global(.treatment-cool) .floor-plane,:global(.treatment-cool) .back-wall{filter:saturate(.35) hue-rotate(12deg) brightness(.8)}
:global(.treatment-cool) .window-light,:global(.treatment-cool) .window-panes,:global(.treatment-cool) .pendant-light,:global(.treatment-cool) .lamp-pool{opacity:.5}
:global(.treatment-editorial) .floor-plane,:global(.treatment-editorial) .back-wall{filter:saturate(.6) contrast(1.08)}
@media(max-width:1000px){.map{margin:0}}
</style>
