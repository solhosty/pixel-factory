<script lang="ts">
  import Sprite from './office/Sprite.svelte';

  export let staff: any[] = [];
  export let board: any[] = [];
  export let openPerson: (person: any) => void;
  let filter = 'All';
  $: people = staff.filter((person) => filter === 'All' || (filter === 'Remote' ? person.environment.kind === 'coder' : person.environment.kind === 'local'));
  const workFor = (person: any) => board.find((task) => task.task_id === person.assignment?.task_id);
</script>

<div class="coworker-list">
  <header>
    <div><p>YOUR COWORKERS</p><h1>Everyone</h1></div>
    <span>{staff.length}</span>
  </header>
  <nav aria-label="Coworker filters">
    {#each ['All', 'In office', 'Remote'] as value}
      <button aria-pressed={filter === value} onclick={() => filter = value}>{value}</button>
    {/each}
  </nav>
  <div class="rows">
    {#each people as person}
      <button class="row" onclick={() => openPerson(person)}>
        <span class="sprite"><Sprite character kind="bust" recipe={person.appearance_recipe}/></span>
        <span class="copy">
          <strong>{person.name}</strong>
          <small>{person.assignment ? `${person.assignment.project_name} · ${person.assignment.task_title}` : 'Available for assignment'}</small>
          <em class:remote={person.environment.kind === 'coder'}>{person.environment.kind === 'coder' ? 'Remote · Coder · not connected' : 'In office · Local'} · {workFor(person)?.working_state || 'available'}</em>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    {/each}
    {#if !people.length}<p class="empty">No coworkers in this view.</p>{/if}
  </div>
</div>

<style>
  .coworker-list{height:calc(100% - 44px);margin:0 6px 5px;padding:17px 14px 14px;background:#efe8d8;border:8px solid #ded5c3;box-shadow:inset 0 0 0 2px #f8f1e1;display:flex;flex-direction:column;min-height:0;color:#64645a;clip-path:polygon(5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px),0 5px)}
  header{display:flex;justify-content:space-between;align-items:end;padding:0 3px 12px;border-bottom:2px solid #d5ccba}header p{font-size:9px;letter-spacing:.13em;margin:0;color:#918875}h1{font-size:21px;margin:3px 0 0}header>span{display:grid;place-items:center;width:27px;height:27px;background:#cbd6bf;color:#617d5b;font-weight:700}
  nav{display:flex;gap:5px;padding:10px 0}nav button{flex:1;border:1px solid #c5b99f;background:#e5dece;color:#756f62;padding:6px 3px;font-size:10px}nav button[aria-pressed=true]{background:#bdcdb0;color:#5d7957;border-color:#91a083}
  .rows{display:grid;gap:7px;overflow:auto;min-height:0;padding-right:2px}.row{display:grid;grid-template-columns:48px minmax(0,1fr) 10px;align-items:center;gap:9px;width:100%;padding:8px;background:#f6efe1;border:2px solid #d5ccba;color:#6b685d;text-align:left}.row:hover{background:#e4ead9;border-color:#adbd9f}.sprite{width:48px;height:49px;overflow:hidden;background:#ddd2bd}.copy{display:grid;min-width:0}.copy strong{font-size:13px}.copy small{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#887f70}.copy em{font-size:9px;font-style:normal;color:#67805f;margin-top:4px}.copy em.remote{color:#9a634c}.empty{font-size:11px;border:1px dashed #bcae96;padding:14px}
</style>
