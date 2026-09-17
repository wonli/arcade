<script>
  import ChessBoard from './ChessBoard.svelte'

  let { frameStore } = $props()
  const replayRoom = { id: 'replay', players: [] }
  const replayIdentity = { sessionId: '' }
</script>

<div class="chess-replay-shell">
  <ChessBoard
    room={replayRoom}
    state={$frameStore}
    identity={replayIdentity}
    readonly={true}
  />
</div>

<style>
  .chess-replay-shell{width:740px;height:740px;display:grid;place-items:center;background:#0b0d10}
</style>
