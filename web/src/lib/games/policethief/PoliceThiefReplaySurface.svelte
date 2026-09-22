<script>
  import PoliceThiefBoard from './PoliceThiefBoard.svelte'

  let { frameStore } = $props()
</script>

<div class="policethief-replay-shell">
  <PoliceThiefBoard state={$frameStore} interactive={false} />
</div>

<style>
  .policethief-replay-shell{width:828px;height:828px;display:grid;place-items:center;background:#0b0d10}
  .policethief-replay-shell :global(.path-board){width:700px}
</style>
