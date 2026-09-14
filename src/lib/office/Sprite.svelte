<script lang="ts">
 import { onMount } from 'svelte';
 import { furniture, seated, sleeping, walkBox, loadAtlas, drawSprite, spriteAtlas } from './sprites';
 export let kind='plant';
 export let recipe:Record<string,string>={};
 export let character=false;
 export let mode='seated';
 export let direction=0;
 export let frame=0;
 let canvas:HTMLCanvasElement, mounted=false, revision=0, failed=false, requestedKey='';
 onMount(()=>{mounted=true;return()=>{mounted=false;revision++;};});
 async function render(kind:string,character:boolean,mode:string,direction:number,frame:number,recipe:Record<string,string>){
  const file=spriteAtlas(character,kind,mode,recipe.hair);
  const box=!character?furniture[kind]:mode==='walking'?walkBox(direction,frame):mode==='sleeping'?sleeping[kind]:seated[kind];
  const key=JSON.stringify([file,box,character,kind==='bust',recipe.skin,recipe.hair,recipe.top]);
  if(key===requestedKey&&!failed)return;
  requestedKey=key;const version=++revision;
  try{const image=await loadAtlas(file);if(mounted&&version===revision){drawSprite(canvas,image,box,recipe,character,kind==='bust');failed=false;}}catch{if(mounted&&version===revision)failed=true;}
 }
 $: if(mounted)void render(kind,character,mode,direction,frame,recipe);
</script>
<canvas bind:this={canvas} class:failed data-sprite={kind} data-mode={mode} data-frame={frame} aria-hidden="true"></canvas>
<style>canvas{display:block;width:100%;height:100%;image-rendering:pixelated;pointer-events:none}.failed{background:#b4745a}</style>
