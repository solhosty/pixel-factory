<script lang="ts">
 export let name='office';
 const pixels:Record<string,string>={
  office:'M5 1h2v1h1v1h1v1h1v1h1v1H9v5H7V8H5v3H3V6H1V5h1V4h1V3h1V2h1Z',
  roster:'M4 1h3v3H4ZM0 3h2v3H0Zm9 0h2v3H9ZM3 5h5v2h1v4H2V7h1ZM0 7h1v4H0Zm10 0h2v4h-2Z',
  projects:'M1 2h4v1h6v7H1Z',
  inbox:'M1 2h10v8H1Zm1 1v1h1v1h1v1h4V5h1V4h1V3ZM2 5v4h8V5H9v1H8v1H4V6H3V5Z',
  history:'M1 8h2v3H1Zm4-3h2v6H5Zm4-4h2v10H9Z',
  settings:'M4 0h3v2h2V1l2 2-1 2h2v3h-2l1 2-2 2-2-1v1H4v-2H2v1L0 9l1-2H0V4h2V2l2 1ZM4 4v3h3V4Z',
  terminal:'M1 2h2v1h1v1h1v2H4v1H3v1H1V6h1V5h1V4H2V3H1Zm5 6h5v2H6Z',
  expand:'M1 1h4v2H3v2H1Zm6 0h4v4H9V3H7ZM1 7h2v2h2v2H1Zm8 0h2v4H7V9h2Z',
  collapse:'M1 1h10v10H1Zm2 2v6h3V3Zm5 0v6h1V3Z',
  close:'M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1Z'
 };
</script>
<svg viewBox="0 0 12 12" aria-hidden="true" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges"><path d={pixels[name]||pixels.office}/></svg>
<style>svg{display:block;width:100%;height:100%}</style>
