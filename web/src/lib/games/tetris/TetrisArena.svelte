<script>
  let {
    board = [],
    nextBoard = [],
    opponent = null,
    opponentName = 'Opponent',
    nextLabel = 'NEXT',
    opponentLabel = 'OPPONENT',
    scoreLabel = 'SCORE',
    linesLabel = 'LINES',
    compact = false,
  } = $props()

  const cells = Array.from({ length: 200 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }))
  const previewCells = Array.from({ length: 16 }, (_, index) => ({ x: index % 4, y: Math.floor(index / 4) }))
</script>

<div class:compact class:solo={!opponent} class="tetris-arena">
  <div class="local-zone">
    <div class="board local" aria-label="Tetris">
      {#each cells as cell}
        {@const value = board?.[cell.y]?.[cell.x] ?? 0}
        <i class:filled={value !== 0} data-value={value}></i>
      {/each}
    </div>
    <aside class="next-panel">
      <span>{nextLabel}</span>
      <div class="preview" aria-label="Next piece">
        {#each previewCells as cell}
          {@const value = nextBoard?.[cell.y]?.[cell.x] ?? 0}
          <i class:filled={value !== 0} data-value={value}></i>
        {/each}
      </div>
    </aside>
  </div>

  {#if opponent}
    <aside class="rival">
      <div class="rival-head"><span>{opponentLabel}</span><strong>{opponentName}</strong></div>
      <div class="board mini" aria-label="Opponent Tetris board">
        {#each cells as cell}
          {@const value = opponent?.board?.[cell.y]?.[cell.x] ?? 0}
          <i class:filled={value !== 0} data-value={value}></i>
        {/each}
      </div>
      <div class="rival-stats">
        <span>{scoreLabel} <strong>{opponent?.score ?? 0}</strong></span>
        <span>{linesLabel} <strong>{opponent?.lines ?? 0}</strong></span>
      </div>
    </aside>
  {/if}
</div>

<style>
  .tetris-arena{--tetris-board-height:min(620px,max(320px,calc(100dvh - 260px)));--tetris-board-width:calc(var(--tetris-board-height)/2);display:grid;grid-template-columns:max-content minmax(130px,180px);gap:clamp(22px,4vw,48px);align-items:start;justify-content:center}
  .tetris-arena.solo{grid-template-columns:max-content}
  .tetris-arena.compact{--tetris-board-height:620px;--tetris-board-width:310px;width:max-content}
  .local-zone{display:grid;grid-template-columns:var(--tetris-board-width) 82px;gap:18px;align-items:start}
  .board{display:grid;grid-template-columns:repeat(10,1fr);background:#080a0d;border:1px solid #30363f;box-shadow:8px 8px 0 #050607;touch-action:none}
  .board.local{width:var(--tetris-board-width);aspect-ratio:1 / 2}
  .board i,.preview i{aspect-ratio:1;border:1px solid #15191f;background:#0d1014}
  .board i.filled,.preview i.filled{background:#c1ff56;border-color:#0b0d10;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}
  .board i[data-value='2'],.board i[data-value='5'],.preview i[data-value='2'],.preview i[data-value='5']{background:#f5ede0}
  .board i[data-value='3'],.board i[data-value='6'],.preview i[data-value='3'],.preview i[data-value='6']{background:#8ee7ff}
  .board i[data-value='4'],.board i[data-value='7'],.preview i[data-value='4'],.preview i[data-value='7']{background:#ffcf5a}
  .board i[data-value='8']{background:#464d57}
  .next-panel{padding-top:2px}.next-panel>span{color:#8b949e;font-size:10px;font-weight:800;letter-spacing:.16em}
  .preview{display:grid;grid-template-columns:repeat(4,1fr);width:82px;margin-top:8px;padding:5px;box-sizing:border-box;background:#080a0d;border:1px solid #30363f}.preview i{border-color:transparent}
  .rival{padding-top:0;width:min(180px,100%)}.rival-head{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}.rival-head span{color:#737b85;font-size:9px;letter-spacing:.14em}.rival-head strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini{width:100%;aspect-ratio:1 / 2;box-shadow:5px 5px 0 #050607}.rival-stats{display:flex;justify-content:space-between;gap:10px;margin-top:9px;color:#7f8791;font-size:10px}.rival-stats strong{color:#f4f0e8}
  @media(max-height:700px){.tetris-arena:not(.compact){--tetris-board-height:min(460px,max(280px,calc(100dvh - 230px)))}}
  @media(hover:none),(pointer:coarse){.tetris-arena:not(.compact){--tetris-board-height:min(540px,max(260px,calc(100dvh - 330px)))}}
  @media(max-width:720px){.tetris-arena:not(.compact){--tetris-board-width:min(calc(var(--tetris-board-height)/2),calc(100vw - 132px));grid-template-columns:max-content 92px;gap:12px}.tetris-arena:not(.compact).solo{grid-template-columns:max-content}.tetris-arena:not(.compact) .local-zone{grid-template-columns:var(--tetris-board-width) 64px;gap:10px}.tetris-arena:not(.compact) .next-panel{padding-top:0}.tetris-arena:not(.compact) .preview{width:64px}.tetris-arena:not(.compact) .rival{width:92px}.tetris-arena:not(.compact) .rival-stats{flex-direction:column;gap:2px}}
  @media(max-width:480px){.tetris-arena:not(.compact){--tetris-board-width:min(calc(var(--tetris-board-height)/2),calc(100vw - 112px));grid-template-columns:max-content 74px;gap:8px}.tetris-arena:not(.compact) .local-zone{grid-template-columns:var(--tetris-board-width) 54px;gap:8px}.tetris-arena:not(.compact) .preview{width:54px;padding:3px}.tetris-arena:not(.compact) .rival{width:74px}.tetris-arena:not(.compact) .rival-stats{font-size:9px}}
</style>
