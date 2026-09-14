<script lang="ts">
 import { onMount } from 'svelte';
 export let kind='talk';
 export let reduced=false;
 let count=1;
 onMount(()=>{const timer=setInterval(()=>{if(!reduced)count=count%3+1;},650);return()=>clearInterval(timer);});
 $: label=kind==='sleep'?'z'.repeat(reduced?3:count):kind==='talk'?'.'.repeat(reduced?3:count):'</>';
</script>
<svg viewBox="0 0 34 34" class:sleep={kind==='sleep'} class:work={kind==='work'} aria-hidden="true" data-bubble={kind} data-phase={reduced?3:count} shape-rendering="crispEdges">
 <path class="shadow" d="M5 3h24v3h3v23H21l-5 5-4-5H3V6h2Z"/>
 <path class="rim" d="M4 1h24v3h3v23H20l-5 5-4-5H1V4h3Z"/>
 <path class="fill" d="M5 3h22v3h2v19H19l-4 4-3-4H3V5h2Z"/>
 <path class="highlight" d="M5 3h22v2H5ZM3 5h2v18H3Z"/>
 <text x="16" y={kind==='talk'?19:19} text-anchor="middle">{label}</text>
</svg>
<style>
svg{display:block;width:100%;height:100%;overflow:visible;--panel:#e7e3df;--ink:#666671;--shine:#f6f0e6}.sleep{--panel:#465d81;--ink:#e8e5df;--shine:#60769a}.work{--panel:#757e49;--ink:#f4d990;--shine:#91996a}.shadow{fill:#362d2b;opacity:.7}.rim{fill:#eee8d9}.fill{fill:var(--panel)}.highlight{fill:var(--shine)}text{fill:var(--ink);font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-1px}.sleep text{font-size:12px}.work text{font-size:10px;letter-spacing:-1.5px}
</style>
