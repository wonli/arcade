<script>
  import { socket } from '$lib/ws/arcade'
  import { boardPoints, legalMovesFrom, pieceColor, pieceLabel } from './board.js'

  export let room
  export let state
  export let identity
  export let onMove
  export let readonly = false
  export let t = (key) => key

  const horizontalLines = Array.from({ length: 10 }, (_, index) => index * 100)
  const verticalLines = Array.from({ length: 9 }, (_, index) => index * 100)

  let selected = null
  let observedPly = -1
  let actionBusy = false
  let actionError = ''
  let resignConfirmOpen = false

  $: myIndex = room?.players?.findIndex((player) => player.id === identity?.sessionId) ?? -1
  $: myColor = myIndex === 0 ? 'red' : myIndex === 1 ? 'black' : ''
  $: flipped = myColor === 'black'
  $: points = boardPoints(flipped)
  $: myTurn = !readonly && state?.status === 'playing' && state?.turn === myColor
  $: if ((state?.ply ?? -1) !== observedPly) {
    observedPly = state?.ply ?? -1
    selected = null
  }
  $: if (state?.status !== 'playing') resignConfirmOpen = false

  // Keep state as an explicit argument. Svelte can then see that board DOM
  // expressions depend on the state prop and rerender immediately on snapshots.
  function pieceAt(currentState, x, y) {
    return currentState?.board?.[y]?.[x] ?? 0
  }

  function legalTo(currentState, x, y) {
    if (!selected) return null
    return legalMovesFrom(currentState, selected.x, selected.y).find((move) => move?.to?.x === x && move?.to?.y === y) ?? null
  }

  function isLastPoint(currentState, x, y) {
    const last = currentState?.last
    return !!last && ((last.from?.x === x && last.from?.y === y) || (last.to?.x === x && last.to?.y === y))
  }

  function isCheckedGeneral(currentState, piece) {
    return !!currentState?.check && Math.abs(piece) === 7 && pieceColor(piece) === currentState?.turn
  }

  function choosePoint(x, y) {
    if (readonly || !myTurn || resignConfirmOpen) return
    const target = legalTo(state, x, y)
    if (target) {
      selected = null
      void onMove?.(target)
      return
    }
    const piece = pieceAt(state, x, y)
    selected = pieceColor(piece) === myColor && legalMovesFrom(state, x, y).length > 0 ? { x, y } : null
  }

  function pointStyle(point) {
    return `left:${(point.displayX / 8) * 100}%;top:${(point.displayY / 9) * 100}%`
  }

  function requestResign() {
    if (readonly || !myColor || state?.status !== 'playing' || actionBusy) return
    actionError = ''
    resignConfirmOpen = true
  }

  async function resign() {
    if (readonly || !myColor || state?.status !== 'playing' || actionBusy) return
    actionBusy = true
    actionError = ''
    try {
      await socket.request('game.resign', { roomId: room.id })
      resignConfirmOpen = false
    } catch (error) {
      actionError = error?.message ?? 'Unable to resign'
    } finally {
      actionBusy = false
    }
  }

  async function rematch() {
    if (readonly || !myColor || actionBusy) return
    actionBusy = true
    actionError = ''
    try {
      await socket.request('room.rematch', { roomId: room.id })
    } catch (error) {
      actionError = error?.message ?? 'Unable to start a new game'
    } finally {
      actionBusy = false
    }
  }

  function resultTitle() {
    if (!state?.winner) return t('room.draw')
    return state.winner === myColor ? t('xiangqi.youWin') : t('xiangqi.youLose')
  }

  function resultDetail() {
    if (state?.drawReason === 'resignation') return state.winner === myColor ? t('xiangqi.opponentResigned') : t('xiangqi.youResigned')
    if (state?.drawReason === 'timeout') return state.winner === myColor ? t('xiangqi.opponentTimedOut') : t('xiangqi.youTimedOut')
    if (state?.winner) return t('xiangqi.checkmate')
    return t('xiangqi.gameOver')
  }
</script>

<div class="xiangqi-wrap">
  <div class="board-shell" aria-label={t('xiangqi.board')}>
    <div class="grid-area">
      <svg class="board-lines" viewBox="0 0 800 900" aria-hidden="true" preserveAspectRatio="none">
        {#each horizontalLines as y}
          <line x1="0" y1={y} x2="800" y2={y} />
        {/each}
        {#each verticalLines as x}
          {#if x === 0 || x === 800}
            <line x1={x} y1="0" x2={x} y2="900" />
          {:else}
            <line x1={x} y1="0" x2={x} y2="400" />
            <line x1={x} y1="500" x2={x} y2="900" />
          {/if}
        {/each}
        <line x1="300" y1="0" x2="500" y2="200" />
        <line x1="500" y1="0" x2="300" y2="200" />
        <line x1="300" y1="700" x2="500" y2="900" />
        <line x1="500" y1="700" x2="300" y2="900" />
        <text x="205" y="470">楚河</text>
        <text x="595" y="470">漢界</text>
      </svg>

      {#each points as point}
        {@const piece = pieceAt(state, point.x, point.y)}
        {@const target = legalTo(state, point.x, point.y)}
        <button
          class="point"
          class:selected={selected?.x === point.x && selected?.y === point.y}
          class:last={isLastPoint(state, point.x, point.y)}
          class:legal={!!target}
          class:capture={!!target && piece !== 0}
          class:occupied={piece !== 0}
          style={pointStyle(point)}
          aria-label={`${point.x + 1},${point.y + 1}${piece ? ` ${pieceLabel(piece)}` : ''}`}
          tabindex={readonly ? -1 : 0}
          onclick={() => choosePoint(point.x, point.y)}
        >
          {#if piece !== 0}
            <span
              class="piece"
              class:red={piece > 0}
              class:black={piece < 0}
              class:checked={isCheckedGeneral(state, piece)}
            >{pieceLabel(piece)}</span>
          {:else if target}
            <span class="move-dot"></span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  {#if !readonly && state?.status === 'playing' && myColor}
    <div class="xiangqi-actions">
      <span class:active={myTurn}>{myTurn ? t('room.yourTurn') : (room?.players?.[1]?.bot && state?.turn === 'black' ? t('room.botTurn') : t('room.opponentTurn'))}</span>
      <button class="resign-button" onclick={requestResign} disabled={actionBusy}>{t('xiangqi.resign')}</button>
    </div>
  {/if}

  {#if !readonly && resignConfirmOpen}
    <div class="modal" role="dialog" aria-modal="true" aria-label={t('xiangqi.resignGame')}>
      <div class="modal-card">
        <span>{t('xiangqi.resignGame')}</span>
        <h2>{t('xiangqi.giveUp')}</h2>
        <p>{t('xiangqi.resignDetail')}</p>
        {#if actionError}<div class="error">{actionError}</div>{/if}
        <div class="modal-actions">
          <button onclick={() => (resignConfirmOpen = false)} disabled={actionBusy}>{t('xiangqi.cancel')}</button>
          <button class="danger" onclick={resign} disabled={actionBusy}>{t('xiangqi.resign')}</button>
        </div>
      </div>
    </div>
  {/if}

  {#if !readonly && state?.status === 'finished'}
    <div class="modal" role="dialog" aria-modal="true" aria-label={t('xiangqi.gameOver')}>
      <div class="modal-card">
        <span>{t('xiangqi.gameOver')}</span>
        <h2>{resultTitle()}</h2>
        <p>{resultDetail()}</p>
        {#if actionError}<div class="error">{actionError}</div>{/if}
        <div class="modal-actions">
          {#if myColor}<button class="play-again" onclick={rematch} disabled={actionBusy}>{t('common.playAgain')}</button>{/if}
          <a href="/">{t('xiangqi.back')}</a>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .xiangqi-wrap{position:relative;width:min(100%,650px);margin:auto}
  .board-shell{padding:34px;background:#c9a66b;border:10px solid #171b20;box-shadow:0 18px 50px #0008,0 0 0 1px #343a42;box-sizing:border-box}
  .grid-area{position:relative;width:100%;aspect-ratio:8/9}
  .board-lines{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .board-lines line{stroke:#4a321e;stroke-width:2.4;vector-effect:non-scaling-stroke}
  .board-lines text{fill:#4a321e;font:700 42px 'Songti SC','STSong','Noto Serif CJK SC',serif;letter-spacing:.18em;text-anchor:middle;dominant-baseline:middle}
  .point{position:absolute;z-index:2;width:11.5%;aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;padding:0;border:0;background:transparent;cursor:default;font:inherit}
  .point.occupied,.point.legal{cursor:pointer}
  .piece{position:relative;z-index:2;display:grid;place-items:center;width:82%;aspect-ratio:1;border-radius:50%;background:#f2e4c7;border:3px solid currentColor;box-shadow:0 3px 0 #6d4c2c,0 7px 13px #0004;font:800 clamp(19px,4.1vw,32px) 'Songti SC','STSong','Noto Serif CJK SC',serif;line-height:1;user-select:none}
  .piece.red{color:#a62824}
  .piece.black{color:#17191c}
  .piece.checked{box-shadow:0 0 0 5px #c1ff56,0 3px 0 #6d4c2c,0 7px 13px #0004}
  .point.selected .piece{box-shadow:0 0 0 5px #c1ff56,0 3px 0 #6d4c2c,0 7px 13px #0004}
  .point.last:before{content:'';position:absolute;width:46%;aspect-ratio:1;border-radius:50%;background:#c1ff56;opacity:.34}
  .point.capture:after{content:'';position:absolute;width:88%;aspect-ratio:1;border:4px solid #c1ff56;border-radius:50%;box-sizing:border-box}
  .move-dot{display:block;width:24%;aspect-ratio:1;border-radius:50%;background:#c1ff56;box-shadow:0 0 0 4px #1b241655}
  .xiangqi-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;color:#7c8691;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em}
  .xiangqi-actions>span.active{color:#c1ff56}
  .resign-button{border:1px solid #734242;background:#171012;color:#d9a3a3;padding:9px 14px;font:inherit;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
  .resign-button:disabled{opacity:.5;cursor:default}
  .modal{position:absolute;z-index:20;inset:0;display:grid;place-items:center;padding:20px;background:#050708c8;backdrop-filter:blur(4px)}
  .modal-card{width:min(88%,380px);padding:30px;border:1px solid #4a525d;background:#111419;box-shadow:12px 12px 0 #050607;text-align:center;box-sizing:border-box}
  .modal-card>span{display:block;color:#89929d;font-size:10px;font-weight:900;letter-spacing:.18em}
  .modal-card h2{margin:8px 0 4px;color:#f4f0e8;font-size:34px;line-height:1}
  .modal-card p{margin:0 0 22px;color:#9ca6b1}
  .error{margin:0 0 12px;color:#ff8a8a;font-size:12px}
  .modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .modal-actions button,.modal-actions a{display:grid;place-items:center;min-height:44px;border:1px solid #3b424c;background:#0b0d10;color:#f4f0e8;font:inherit;font-size:11px;font-weight:900;letter-spacing:.08em;text-decoration:none;text-transform:uppercase;cursor:pointer}
  .modal-actions .danger{border-color:#8d4747;background:#6d2929;color:#ffe7e7}
  .modal-actions .play-again{border-color:#799b45;background:#c1ff56;color:#10140c}
  @media(max-width:640px){.board-shell{padding:24px;border-width:6px}.piece{width:88%;font-size:clamp(17px,7vw,27px);border-width:2px}.board-lines text{font-size:36px}.point{width:13%}}
</style>
