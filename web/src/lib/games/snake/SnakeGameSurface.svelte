<script>
  let {
    state = null,
    interactive = false,
    onPointerDown = null,
    onPointerUp = null,
    onPointerCancel = null,
    scoreboardLabel = 'SCOREBOARD',
    scoreLabel = 'SCORE',
    aliveLabel = 'ALIVE',
    outLabel = 'OUT',
    keyboardLabel = '',
    compact = false,
  } = $props()

  const cells = Array.from({ length: 30 * 20 }, (_, index) => ({ x: index % 30, y: Math.floor(index / 30) }))

  function snakeIndexAt(snapshot,x,y){ if(!snapshot)return-1; for(let index=0;index<snapshot.snakes.length;index++){if(snapshot.snakes[index].body?.some((point)=>point.x===x&&point.y===y))return index}return-1 }
  function isHead(snapshot,index,x,y){const head=snapshot?.snakes?.[index]?.body?.[0];return head?.x===x&&head?.y===y}
  function isFood(snapshot,x,y){return snapshot?.food?.x===x&&snapshot?.food?.y===y}
</script>

<div class:compact class="arena-layout">
  <div class="play-zone">
    <div
      class="snake-board"
      aria-label="Snake"
      onpointerdown={interactive ? onPointerDown : undefined}
      onpointerup={interactive ? onPointerUp : undefined}
      onpointercancel={interactive ? onPointerCancel : undefined}
    >
      {#each cells as cell}
        {@const snakeIndex=snakeIndexAt(state,cell.x,cell.y)}
        <i class:food={isFood(state,cell.x,cell.y)} class:snake={snakeIndex>=0} class:head={snakeIndex>=0&&isHead(state,snakeIndex,cell.x,cell.y)} data-player={snakeIndex}></i>
      {/each}
    </div>
  </div>
  <aside class="leaderboard">
    <span>{scoreboardLabel}</span>
    {#each state?.snakes??[] as snake,index}
      <div class:dead={!snake.alive} class="score-row">
        <i data-player={index}></i>
        <div class="player-info"><strong>{snake.name ?? `PLAYER ${index + 1}`}</strong><small>{snake.alive?aliveLabel:outLabel}</small></div>
        <div class="score-value"><small>{scoreLabel}</small><b>{snake.score}</b></div>
      </div>
    {/each}
    {#if keyboardLabel}<div class="keys">{keyboardLabel}</div>{/if}
  </aside>
</div>

<style>
  .arena-layout{display:grid;grid-template-columns:minmax(560px,900px) 240px;gap:24px;align-items:start}.play-zone{min-width:0}.snake-board{display:grid;grid-template-columns:repeat(30,1fr);aspect-ratio:30/20;background:#080a0d;border:1px solid #30363f;box-shadow:10px 10px 0 #050607;touch-action:none;user-select:none}.snake-board>i{min-width:0;aspect-ratio:1;border:1px solid #11151a}.snake-board>i.food{background:#f4f0e8;border-radius:50%;transform:scale(.55)}.snake-board>i.snake{background:#c1ff56;border-color:#080a0d}.snake-board>i.head{box-shadow:inset 0 0 0 2px rgba(255,255,255,.55)}.leaderboard{padding:16px;border:1px solid #2d333b;background:#0b0d10}.leaderboard>span{color:#7f8791;font-size:10px;font-weight:900;letter-spacing:.18em}.score-row{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #20252c}.score-row.dead{opacity:.38}.score-row>i{width:10px;height:10px;background:#c1ff56}.player-info,.score-value{display:flex;flex-direction:column;gap:2px}.score-row strong{font-size:12px}.score-row small{color:#69727d;font-size:8px;letter-spacing:.12em}.score-value{text-align:right;align-items:flex-end}.score-value b{font:900 18px ui-monospace,monospace;color:#c1ff56}.keys{margin-top:16px;color:#69727d;font:10px ui-monospace,monospace;text-align:center}
  [data-player='0']{background:#c1ff56!important}[data-player='1']{background:#8ee7ff!important}[data-player='2']{background:#ffcf5a!important}[data-player='3']{background:#ff8db3!important}[data-player='4']{background:#b9a1ff!important}[data-player='5']{background:#75f0c0!important}[data-player='6']{background:#ff9f62!important}[data-player='7']{background:#f4f0e8!important}
  .arena-layout.compact{grid-template-columns:900px 240px;width:1164px;gap:24px}
  @media(max-width:820px){.arena-layout:not(.compact){grid-template-columns:1fr;gap:18px}.arena-layout:not(.compact) .leaderboard{display:grid;grid-template-columns:repeat(2,1fr);gap:0 16px}.arena-layout:not(.compact) .leaderboard>span,.arena-layout:not(.compact) .keys{grid-column:1/-1}.arena-layout:not(.compact) .snake-board{width:100%;box-shadow:6px 6px 0 #050607}}
  @media(max-width:520px){.arena-layout:not(.compact) .leaderboard{grid-template-columns:1fr}}
</style>
