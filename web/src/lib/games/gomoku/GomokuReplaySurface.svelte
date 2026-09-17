<script>
  import GomokuBoard from './GomokuBoard.svelte'

  let { frameStore } = $props()
</script>

<div class="gomoku-replay-shell">
  <div class="board-frame replay-board-frame">
    <GomokuBoard state={$frameStore} interactive={false} />
  </div>
</div>

<style>
  .gomoku-replay-shell{width:828px;height:828px;display:grid;place-items:center;background:#0b0d10}
  .replay-board-frame{box-sizing:border-box;width:828px;padding:34px}
</style>
