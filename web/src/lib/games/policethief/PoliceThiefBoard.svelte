<script>
  import { EDGES, NODES, legalMoves, nodeById } from './graph.js'

  let {
    state = null,
    interactive = false,
    role = '',
    onMove = () => {},
    boardLabel = 'Police and Thief path board',
    moveLabel = (node) => `Move to node ${node}`,
    thiefLabel = 'THIEF',
    policeLabel = 'POLICE',
  } = $props()

  function playable(node) {
    if (!interactive || !state || state.status !== 'playing' || state.turn !== role) return false
    return legalMoves(state, role).includes(node)
  }

  function choose(node) {
    if (!playable(node)) return
    onMove(node)
  }

  function isLast(node) {
    return state?.last?.to === node
  }
</script>

<div class="path-board" aria-label={boardLabel}>
  <svg class="paths" viewBox="0 0 100 100" aria-hidden="true">
    {#each EDGES as edge}
      {@const from = nodeById(edge[0])}
      {@const to = nodeById(edge[1])}
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}></line>
    {/each}
  </svg>

  {#each NODES as node}
    <button
      class="node"
      class:playable={playable(node.id)}
      class:last={isLast(node.id)}
      style={`left:${node.x}%;top:${node.y}%`}
      onclick={() => choose(node.id)}
      aria-label={moveLabel(node.id)}
      disabled={!playable(node.id)}
      tabindex={interactive ? 0 : -1}
    >
      <span class="node-core"></span>
      {#if state?.thief === node.id && state?.police === node.id}
        <span class="piece captured thief-piece">{thiefLabel}</span>
        <span class="piece captured police-piece">{policeLabel}</span>
      {:else if state?.thief === node.id}
        <span class="piece thief-piece">{thiefLabel}</span>
      {:else if state?.police === node.id}
        <span class="piece police-piece">{policeLabel}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .path-board{position:relative;width:min(72vmin,680px);aspect-ratio:1/1;max-width:100%;overflow:hidden;background:#0d1014;border:1px solid #272c33;box-shadow:0 26px 80px rgba(0,0,0,.26)}
  .path-board:before{content:'';position:absolute;inset:7%;border:1px solid #181d23;pointer-events:none}
  .paths{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .paths line{stroke:#59616b;stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:square}
  .node{position:absolute;width:92px;height:62px;transform:translate(-50%,-50%);padding:0;border:0;background:transparent;display:grid;place-items:center;cursor:default}
  .node-core{position:absolute;width:18px;height:18px;border:2px solid #69727d;border-radius:50%;background:#0d1014;box-sizing:border-box;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
  .node.last .node-core{border-color:#a6afb8}
  .node.playable{cursor:pointer}
  .node.playable .node-core{width:26px;height:26px;border-color:#c1ff56;box-shadow:0 0 0 6px rgba(193,255,86,.08),0 0 26px rgba(193,255,86,.18)}
  .node.playable:hover .node-core,.node.playable:focus-visible .node-core{transform:scale(1.18);box-shadow:0 0 0 9px rgba(193,255,86,.1),0 0 34px rgba(193,255,86,.28)}
  .node:focus-visible{outline:1px solid #c1ff56;outline-offset:2px}
  .piece{position:absolute;z-index:2;display:grid;place-items:center;width:74px;height:30px;border-radius:999px;font:950 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;box-sizing:border-box;box-shadow:0 8px 22px rgba(0,0,0,.42);pointer-events:none;transition:transform .18s ease;white-space:nowrap}
  .thief-piece{background:#c1ff56;color:#0b0d10;border:3px solid #0b0d10}
  .police-piece{background:#f4f0e8;color:#0b0d10;border:3px solid #77818b}
  .captured.thief-piece{transform:translate(-18px,8px) scale(.84)}
  .captured.police-piece{transform:translate(18px,-8px) scale(.88)}
  @media(max-width:650px){.path-board{width:min(92vw,560px)}.node{width:80px;height:54px}.piece{width:66px;height:28px;font-size:9px}.node-core{width:16px;height:16px}.node.playable .node-core{width:23px;height:23px}}
</style>
