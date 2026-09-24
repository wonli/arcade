<script>
  import XiangqiBoard from './XiangqiBoard.svelte'

  let { frameStore } = $props()
  const replayRoom = { id: 'replay', players: [] }
  const replayIdentity = { sessionId: '' }
</script>

<div class="xiangqi-replay-shell">
  <XiangqiBoard
    room={replayRoom}
    state={$frameStore}
    identity={replayIdentity}
    readonly={true}
  />
</div>

<style>
  .xiangqi-replay-shell{width:740px;height:840px;display:grid;place-items:center;background:#0b0d10}
</style>
