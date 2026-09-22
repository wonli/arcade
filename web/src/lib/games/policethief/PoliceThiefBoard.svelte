<script>
  import policeIcon from '../../../../../game/policethief/assets/p.svg'
  import thiefIcon from '../../../../../game/policethief/assets/t.svg'
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

  function isLastEdge(edge) {
    if (!state?.last?.from || !state?.last?.to) return false
    const [from, to] = edge
    return (from === state.last.from && to === state.last.to) || (from === state.last.to && to === state.last.from)
  }
</script>

<div class="path-board" aria-label={boardLabel}>
  <div class="board-surface" aria-hidden="true"></div>
  <div class="board-grid" aria-hidden="true"></div>
  <div class="board-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

  <svg class="paths" viewBox="0 0 100 100" aria-hidden="true">
    {#each EDGES as edge}
      {@const from = nodeById(edge[0])}
      {@const to = nodeById(edge[1])}
      <line class="path-halo" class:last-path={isLastEdge(edge)} x1={from.x} y1={from.y} x2={to.x} y2={to.y}></line>
      <line class="path-line" class:last-path={isLastEdge(edge)} x1={from.x} y1={from.y} x2={to.x} y2={to.y}></line>
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
      <span class="node-target" aria-hidden="true"></span>
      <span class="node-core" aria-hidden="true"></span>
      <span class="node-id" aria-hidden="true">{node.id}</span>

      {#if state?.thief === node.id && state?.police === node.id}
        <span class="piece captured thief-piece" class:active-piece={state?.turn === 'thief'}>
          <span class="portrait"><img src={thiefIcon} alt="" /></span>
          <span class="piece-name">{thiefLabel}</span>
        </span>
        <span class="piece captured police-piece" class:active-piece={state?.turn === 'police'}>
          <span class="portrait"><img src={policeIcon} alt="" /></span>
          <span class="piece-name">{policeLabel}</span>
        </span>
      {:else if state?.thief === node.id}
        <span class="piece thief-piece" class:active-piece={state?.turn === 'thief'}>
          <span class="portrait"><img src={thiefIcon} alt="" /></span>
          <span class="piece-name">{thiefLabel}</span>
        </span>
      {:else if state?.police === node.id}
        <span class="piece police-piece" class:active-piece={state?.turn === 'police'}>
          <span class="portrait"><img src={policeIcon} alt="" /></span>
          <span class="piece-name">{policeLabel}</span>
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .path-board{position:relative;isolation:isolate;width:min(72vmin,680px);aspect-ratio:1/1;max-width:100%;margin-inline:auto;box-sizing:border-box;overflow:hidden;background:#080b0f;border:1px solid #2b3139;box-shadow:0 28px 90px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.018)}
  .path-board:before{content:'';position:absolute;z-index:0;inset:0;background:radial-gradient(circle at 50% 42%,rgba(193,255,86,.045),transparent 48%);pointer-events:none}
  .board-surface{position:absolute;z-index:1;inset:6.5%;background:#111820;border:1px solid #28323c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.018),inset 0 18px 54px rgba(255,255,255,.012),0 16px 42px rgba(0,0,0,.16);pointer-events:none}
  .board-grid{position:absolute;z-index:2;inset:6.5%;opacity:.22;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,transparent 2%,#000 22%,#000 78%,transparent 98%);pointer-events:none}
  .board-frame{position:absolute;z-index:3;inset:4.5%;pointer-events:none}
  .board-frame i{position:absolute;width:24px;height:24px;border-color:#606a75;opacity:.48}
  .board-frame i:nth-child(1){left:0;top:0;border-left:2px solid;border-top:2px solid}
  .board-frame i:nth-child(2){right:0;top:0;border-right:2px solid;border-top:2px solid}
  .board-frame i:nth-child(3){left:0;bottom:0;border-left:2px solid;border-bottom:2px solid}
  .board-frame i:nth-child(4){right:0;bottom:0;border-right:2px solid;border-bottom:2px solid}
  .paths{position:absolute;z-index:4;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
  .paths line{vector-effect:non-scaling-stroke;stroke-linecap:round;transition:stroke .18s ease,opacity .18s ease}
  .path-halo{stroke:#c1ff56;stroke-width:8;opacity:.045}
  .path-line{stroke:#aab4bf;stroke-width:3;opacity:1}
  .path-halo.last-path{opacity:.12}
  .path-line.last-path{stroke:#d6dde4;opacity:1}
  .node{position:absolute;z-index:5;width:112px;height:104px;transform:translate(-50%,-50%);padding:0;border:0;background:transparent;display:grid;place-items:center;cursor:default;overflow:visible}
  .node-target{position:absolute;width:54px;height:54px;border:1px solid rgba(123,134,146,.13);border-radius:50%;transform:scale(.72);opacity:0;transition:opacity .15s ease,transform .15s ease,border-color .15s ease,box-shadow .15s ease}
  .node-core{position:absolute;width:26px;height:26px;border:2px solid #7c8792;border-radius:50%;background:#0c1117;box-sizing:border-box;box-shadow:0 0 0 5px #111820,0 5px 14px rgba(0,0,0,.34);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
  .node-id{position:absolute;top:72px;min-width:20px;padding:2px 5px;border:1px solid rgba(115,125,136,.28);background:#0c1117;color:#8a949f;font:800 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;box-sizing:border-box}
  .node.last .node-core{border-color:#bac3cd}
  .node.last .node-id{color:#aeb7c1;border-color:rgba(174,183,193,.38)}
  .node.playable{cursor:pointer}
  .node.playable .node-target{opacity:1;transform:scale(1);border-color:rgba(193,255,86,.52);box-shadow:0 0 0 7px rgba(193,255,86,.045),0 0 24px rgba(193,255,86,.13)}
  .node.playable .node-core{border-color:#c1ff56;box-shadow:0 0 0 5px #111820,0 0 24px rgba(193,255,86,.24)}
  .node.playable .node-id{color:#c1ff56;border-color:rgba(193,255,86,.28)}
  .node.playable:hover .node-target,.node.playable:focus-visible .node-target{transform:scale(1.16);box-shadow:0 0 0 9px rgba(193,255,86,.06),0 0 34px rgba(193,255,86,.22)}
  .node.playable:hover .node-core,.node.playable:focus-visible .node-core{transform:scale(1.12)}
  .node:focus-visible{outline:1px solid #c1ff56;outline-offset:2px}
  .piece{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;width:76px;min-height:78px;pointer-events:none;filter:drop-shadow(0 12px 15px rgba(0,0,0,.38));transition:transform .18s ease,filter .18s ease}
  .portrait{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#12171d;border:2px solid #4e5964;box-sizing:border-box;overflow:hidden;box-shadow:0 0 0 4px #0b0e12}
  .portrait img{display:block;width:52px;height:52px;object-fit:contain}
  .piece-name{margin-top:6px;min-width:58px;padding:4px 7px;border:2px solid #0b0e12;border-radius:999px;text-align:center;font:950 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;box-sizing:border-box;white-space:nowrap}
  .thief-piece .portrait{border-color:#87933e;background:#171a12}
  .thief-piece .piece-name{background:#c1ff56;color:#0a0c0f}
  .police-piece .portrait{border-color:#72869c;background:#121820}
  .police-piece .piece-name{background:#edf2f6;color:#0a0c0f}
  .piece.active-piece{filter:drop-shadow(0 12px 15px rgba(0,0,0,.38)) drop-shadow(0 0 13px rgba(193,255,86,.2))}
  .piece.active-piece .portrait{box-shadow:0 0 0 4px #0b0e12,0 0 0 6px rgba(193,255,86,.28)}
  .captured.thief-piece{transform:translate(-24px,12px) scale(.78)}
  .captured.police-piece{transform:translate(24px,-12px) scale(.82)}
  @media(max-width:650px){
    .path-board{width:100%}
    .board-surface,.board-grid{inset:2.5%}
    .board-frame{display:none}
    .node{width:92px;height:90px}
    .node-id{top:61px}
    .piece{width:66px;min-height:68px}
    .portrait{width:50px;height:50px}
    .portrait img{width:45px;height:45px}
    .piece-name{min-width:52px;font-size:8px;padding:3px 6px}
    .node-core{width:22px;height:22px}
    .node-target{width:46px;height:46px}
  }
</style>
