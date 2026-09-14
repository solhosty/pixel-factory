<script lang="ts">
  import { onMount } from 'svelte';
  import Sprite from '$lib/office/Sprite.svelte';
  import StatusBubble from '$lib/office/StatusBubble.svelte';
  let playing = true, frame = 0;
  let identity='studio-character-01';
  const identities:Record<string,Record<string,string>>={
    'studio-character-01':{skin:'sienna-01',hair:'short-auburn-03',top:'cardigan-navy-01'},
    'studio-character-02':{skin:'umber-02',hair:'short-auburn-03',top:'cardigan-navy-01'},
    'studio-character-03':{body:'identity-03',skin:'medium-brown-03',hair:'wavy-dark-03',top:'overshirt-ochre-03'},
    'studio-character-04':{body:'identity-04',skin:'olive-04',hair:'pixie-silver-04',top:'vest-moss-04',accessory:'square-glasses-04'},
    'studio-character-05':{body:'identity-05',skin:'deep-brown-05',hair:'natural-curls-05',top:'cardigan-clay-05'},
    'studio-character-06':{body:'identity-06',skin:'warm-medium-06',hair:'side-part-ink-06',top:'sweater-navy-06',accessory:'none'}
  };
  $: recipe=identities[identity];
  const directions = ['south', 'west', 'east', 'north'];
  const states = ['Standing', 'Walking', 'Seated', 'Sleeping', 'Portrait'];
  onMount(() => {
    playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setInterval(() => { if (playing) frame = (frame + 1) % 6; }, 130);
    return () => clearInterval(timer);
  });
</script>

<svelte:head><title>Character studio · Pixel Harness</title></svelte:head>
<main>
  <header><div><a href="/">← Office</a><h1>Character studio</h1><p>Compare every pose at the same scale. Pause to inspect each step.</p></div><span class="frame-number">Frame {frame + 1} / 6</span></header>
  <section class="controls" aria-label="Preview controls">
    <button onclick={() => playing = !playing}>{playing ? 'Pause animation' : 'Play animation'}</button>
    <button onclick={() => { playing = false; frame = (frame + 1) % 6; }}>Next frame</button>
    <label>Predefined identity <select bind:value={identity}>{#each Object.keys(identities) as id}<option value={id}>{id}</option>{/each}</select></label>
  </section>
  <div class="matrix">
    {#each states as state}
      <section class="state"><h2>{state}</h2><div class="facings">
        {#each directions as facing, direction}
          <figure>
            <div class="stage" data-state={state} data-facing={facing}>
              {#if state === 'Seated' || state === 'Sleeping'}<div class="chair" class:foreground={facing === 'north'}><Sprite kind={`chair-${facing}`}/></div>{/if}
              <div class="body" class:portrait={state==='Portrait'}><Sprite character kind={state==='Portrait'?'bust':facing} {direction} {recipe} mode={state === 'Sleeping' ? 'sleeping' : state === 'Seated' || state==='Portrait' ? 'seated' : 'walking'} frame={state === 'Walking' ? frame : 2}/></div>
              {#if state === 'Sleeping'}<div class="bubble"><StatusBubble kind="sleep" reduced={!playing}/></div>{/if}
            </div><figcaption>{facing}</figcaption>
          </figure>
        {/each}
      </div></section>
    {/each}
  </div>
  <footer><span class="sample-bubble"><StatusBubble kind="talk" reduced={!playing}/></span><p>48 × 80 logical pixels · six walk frames per direction. Identity controls preview complete fixed families without editing employee records.</p></footer>
</main>

<style>
 :global(body){margin:0;background:#1b1c23;color:#e0d8c6;font:14px/1.5 system-ui,sans-serif} :global(*){box-sizing:border-box}main{max-width:1250px;margin:auto;padding:28px}header{display:flex;justify-content:space-between;align-items:center;gap:24px}a{color:#c6d3ad}h1{font-size:26px;margin:12px 0 4px}p{color:#b0aa9c;margin:0}h2{font-size:15px;font-weight:500;margin:0 0 12px;color:#cec3a8}.frame-number{font:13px monospace;white-space:nowrap}.controls{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:24px 0;padding:16px;background:#252731;border:1px solid #484a55}button,select{font:inherit;background:#e7dfcd;border:2px solid #b3a88f;color:#49493d;padding:8px 12px}button{cursor:pointer}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #caaf70;outline-offset:3px}label{display:grid;gap:4px;font-size:11px;color:#b8b09d}.matrix{display:grid;grid-template-columns:1fr 1fr;gap:24px}.state{min-width:0}.facings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}figure{margin:0;background:#332b27;border:1px solid #645342}.stage{position:relative;height:190px;isolation:isolate;background:linear-gradient(transparent 89%,#b7996033 89%,#b7996033 90%,transparent 90%)}.body{position:absolute;width:96px;height:160px;left:50%;bottom:16px;transform:translateX(-50%);z-index:2}.body.portrait{height:100px;bottom:44px}.chair{position:absolute;width:96px;height:98px;left:50%;bottom:0;transform:translateX(-50%);z-index:1}.chair.foreground{z-index:3}.bubble{position:absolute;right:2px;top:2px;width:32px;height:32px;z-index:4}figcaption{text-align:center;text-transform:capitalize;color:#c7b99b;font-size:12px;padding:8px;background:#25231f}footer{display:flex;gap:16px;align-items:center;margin-top:24px;font-size:12px}.sample-bubble{display:block;width:34px;flex-shrink:0}@media(max-width:900px){.matrix{grid-template-columns:1fr}}@media(max-width:500px){main{padding:16px}.facings{grid-template-columns:1fr 1fr}header{align-items:start}.frame-number{padding-top:14px}}
</style>
