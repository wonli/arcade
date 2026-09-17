<script>
  import DrawCanvasSurface from './DrawCanvasSurface.svelte'

  let { frameStore } = $props()
</script>

<div class="draw-replay-shell">
  <DrawCanvasSurface strokes={$frameStore?.strokes ?? []} locked={true} compact={true} />
</div>

<style>
  .draw-replay-shell{width:960px;height:600px;display:grid;place-items:center;background:#0b0d10}
</style>
