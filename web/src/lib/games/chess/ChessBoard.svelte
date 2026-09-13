<script>
  import { onDestroy } from 'svelte'
  import { socket } from '$lib/ws/arcade'
  import { chessPieceAsset } from './pieces.js'
  import { chessAudioSources, chessMoveEffect } from './audio.js'

  export let room
  export let state
  export let identity
  export let onMove

  const baseCells = Array.from({ length: 64 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8) }))
  const promotionValues = { q: 5, r: 4, b: 3, n: 2 }

  let selected = null
  let pendingPromotion = null
  let observedPly = -1
  let observedAudioPly = -1
  let previousAudioState = null
  let audioUnlocked = false
  let bgm = null
  let moveAudio = null
  let captureAudio = null
  let actionBusy = false
  let actionError = ''

  $: myIndex = room?.players?.findIndex((player) => player.id === identity.sessionId) ?? -1
  $: myColor = myIndex === 0 ? 'white' : myIndex === 1 ? 'black' : ''
  $: flipped = myColor === 'black'
  $: cells = flipped ? [...baseCells].reverse() : baseCells
  $: myTurn = state?.status === 'playing' && state?.turn === myColor
  $: if ((state?.ply ?? -1) !== observedPly) { observedPly = state?.ply ?? -1; selected = null; pendingPromotion = null }
  $: if (state && (state.ply ?? -1) !== observedAudioPly) {
    const effect = chessMoveEffect(previousAudioState, state)
    if (effect) playChessEffect(effect)
    previousAudioState = snapshotAudioState(state)
    observedAudioPly = state.ply ?? -1
    if (state.status === 'finished') bgm?.pause()
  }

  function snapshotAudioState(value) { return { ply: value?.ply ?? -1, board: value?.board?.map((row) => [...row]) ?? [] } }
  function ensureAudio() {
    if (typeof window === 'undefined') return
    if (!bgm) { bgm = new Audio(chessAudioSources.bgm); bgm.loop = true; bgm.preload = 'auto'; bgm.volume = 0.08 }
    if (!moveAudio) { moveAudio = new Audio(chessAudioSources.move); moveAudio.preload = 'auto'; moveAudio.volume = 0.55 }
    if (!captureAudio) { captureAudio = new Audio(chessAudioSources.capture); captureAudio.preload = 'auto'; captureAudio.volume = 0.62 }
  }
  function unlockAudio() { if (typeof window === 'undefined') return; audioUnlocked = true; ensureAudio(); if (bgm?.paused && state?.status !== 'finished') bgm.play().catch(() => {}) }
  function playChessEffect(effect) { if (!audioUnlocked) return; ensureAudio(); const audio = effect === 'capture' ? captureAudio : moveAudio; if (!audio) return; audio.pause(); audio.currentTime = 0; audio.play().catch(() => {}) }

  function pieceAt(currentState, x, y) { return currentState?.board?.[y]?.[x] ?? 0 }
  function pieceColor(piece) { return piece > 0 ? 'white' : piece < 0 ? 'black' : '' }
  function legalFrom(currentState, x, y) { return (currentState?.legalMoves ?? []).filter((move) => move.from.x === x && move.from.y === y) }
  function legalTo(currentState, x, y) { return selected ? legalFrom(currentState, selected.x, selected.y).filter((move) => move.to.x === x && move.to.y === y) : [] }
  function isLegalTarget(currentState, x, y) { return legalTo(currentState, x, y).length > 0 }
  function isLastSquare(currentState, x, y) { const last = currentState?.last; return !!last && ((last.from.x === x && last.from.y === y) || (last.to.x === x && last.to.y === y)) }

  function chooseSquare(x, y) {
    unlockAudio()
    if (!myTurn || pendingPromotion) return
    const piece = pieceAt(state, x, y)
    if (selected) {
      const targets = legalTo(state, x, y)
      if (targets.length > 0) {
        const promotions = [...new Set(targets.map((move) => move.promotion).filter(Boolean))]
        if (promotions.length > 1) { pendingPromotion = { moves: targets, x, y }; return }
        submit(targets[0]); return
      }
    }
    selected = pieceColor(piece) === myColor && legalFrom(state, x, y).length > 0 ? { x, y } : null
  }

  async function submit(move) { selected = null; pendingPromotion = null; await onMove?.(move) }
  async function resign() {
    if (!myColor || state?.status !== 'playing' || actionBusy) return
    if (typeof window !== 'undefined' && !window.confirm('Resign this game?')) return
    actionBusy = true; actionError = ''
    try { await socket.request('game.resign', { roomId: room.id }) } catch (error) { actionError = error?.message ?? 'Unable to resign' } finally { actionBusy = false }
  }
  async function rematch() {
    if (!myColor || actionBusy) return
    actionBusy = true; actionError = ''
    try { await socket.request('room.rematch', { roomId: room.id }) } catch (error) { actionError = error?.message ?? 'Unable to start a new game' } finally { actionBusy = false }
  }
  function resultTitle() { if (!state?.winner) return 'Draw'; return state.winner === myColor ? 'You win' : 'You lose' }
  function resultDetail() {
    if (state?.drawReason === 'resignation') return state.winner === myColor ? 'Opponent resigned' : 'You resigned'
    if (state?.winner) return 'Checkmate'
    if (state?.drawReason === 'stalemate') return 'Stalemate'
    if (state?.drawReason === 'threefold-repetition') return 'Threefold repetition'
    if (state?.drawReason === 'fifty-move') return 'Fifty-move rule'
    if (state?.drawReason === 'insufficient-material') return 'Insufficient material'
    return 'Game over'
  }
  function promoteTo(piece) { const move = pendingPromotion?.moves?.find((candidate) => candidate.promotion === piece); if (move) submit(move) }
  function promotionAsset(piece) { const value = promotionValues[piece] ?? 5; return chessPieceAsset(myColor === 'black' ? -value : value) }
  function fileLabel(x) { return String.fromCharCode(97 + x) }
  function rankLabel(y) { return String(8 - y) }
  onDestroy(() => { for (const audio of [bgm, moveAudio, captureAudio]) { if (!audio) continue; audio.pause(); audio.src = '' } })
</script>

<div class="chess-wrap" onpointerdown={unlockAudio}>
  <div class:flipped class="chess-board" aria-label="International chess board">
    {#each cells as cell}
      <button class="chess-cell" class:light={(cell.x + cell.y) % 2 === 0} class:dark={(cell.x + cell.y) % 2 === 1} class:selected={selected?.x === cell.x && selected?.y === cell.y} class:target={isLegalTarget(state, cell.x, cell.y)} class:capture={isLegalTarget(state, cell.x, cell.y) && pieceAt(state, cell.x, cell.y) !== 0} class:last={isLastSquare(state, cell.x, cell.y)} onclick={() => chooseSquare(cell.x, cell.y)} aria-label={`${fileLabel(cell.x)}${rankLabel(cell.y)}`}>
        {#if cell.x === (flipped ? 7 : 0)}<span class="rank">{rankLabel(cell.y)}</span>{/if}
        {#if cell.y === (flipped ? 0 : 7)}<span class="file">{fileLabel(cell.x)}</span>{/if}
        {#if pieceAt(state, cell.x, cell.y) !== 0}
          <img class="piece" class:white-piece={pieceAt(state, cell.x, cell.y) > 0} class:black-piece={pieceAt(state, cell.x, cell.y) < 0} src={chessPieceAsset(pieceAt(state, cell.x, cell.y))} alt="" draggable="false" />
        {:else if isLegalTarget(state, cell.x, cell.y)}<span class="move-dot"></span>{/if}
      </button>
    {/each}
  </div>

  {#if state?.status === 'playing' && myColor}<div class="chess-actions"><button class="resign-button" onclick={resign} disabled={actionBusy}>Resign</button>{#if actionError}<span>{actionError}</span>{/if}</div>{/if}

  {#if pendingPromotion}
    <div class="promotion" role="dialog" aria-label="Choose promotion piece"><span>PROMOTE TO</span><div>{#each ['q', 'r', 'b', 'n'] as piece}<button onclick={() => promoteTo(piece)} aria-label={`Promote to ${piece}`}><img class:white-piece={myColor !== 'black'} class:black-piece={myColor === 'black'} src={promotionAsset(piece)} alt="" draggable="false" /></button>{/each}</div><button class="cancel" onclick={() => (pendingPromotion = null)}>Cancel</button></div>
  {/if}

  {#if state?.status === 'finished'}
    <div class="chess-result-modal" role="dialog" aria-modal="true" aria-label="Chess result"><div class="result-card"><span class="result-kicker">GAME OVER</span><h2>{resultTitle()}</h2><p>{resultDetail()}</p>{#if actionError}<div class="result-error">{actionError}</div>{/if}<div class="result-actions">{#if myColor}<button class="play-again" onclick={rematch} disabled={actionBusy}>Play again</button>{/if}<a href="/">Back to arcade</a></div></div></div>
  {/if}
</div>

<style>
  .chess-wrap{position:relative;width:min(100%,720px);margin:auto}.chess-board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;border:10px solid #171b20;box-shadow:0 18px 50px #0008,0 0 0 1px #343a42}.chess-cell{position:relative;display:grid;place-items:center;min-width:0;aspect-ratio:1;border:0;padding:0;cursor:default;font:inherit}.chess-cell.light{background:#d9d1bd}.chess-cell.dark{background:#68745d}.chess-cell.last{box-shadow:inset 0 0 0 999px #c1ff5630}.chess-cell.selected{box-shadow:inset 0 0 0 4px #c1ff56}.chess-cell.target{cursor:pointer}.chess-cell.target:after{content:'';position:absolute;width:28%;aspect-ratio:1;border:2px solid #c1ff56;border-radius:50%;opacity:.85}.chess-cell.capture:after{width:72%;border-width:4px;background:transparent}.piece{position:relative;z-index:2;display:block;width:78%;height:78%;object-fit:contain;user-select:none;-webkit-user-drag:none;pointer-events:none}.white-piece{filter:invert(1) drop-shadow(0 2px 1px #0008)}.black-piece{filter:drop-shadow(0 2px 1px #fff5)}.move-dot{width:18%;aspect-ratio:1;border-radius:50%;background:#c1ff56;box-shadow:0 0 0 4px #0b0d1025}.rank,.file{position:absolute;z-index:3;font-size:9px;font-weight:900;opacity:.7;pointer-events:none}.rank{top:4px;left:5px}.file{right:5px;bottom:3px}.dark .rank,.dark .file{color:#e9e1d0}.light .rank,.light .file{color:#4d5746}.chess-actions{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:12px}.chess-actions span,.result-error{color:#ff8a8a;font-size:12px}.resign-button{border:1px solid #734242;background:#171012;color:#d9a3a3;padding:9px 14px;font:inherit;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.resign-button:hover{border-color:#b25e5e;color:#ffd0d0}.resign-button:disabled{opacity:.5;cursor:default}.promotion{position:absolute;inset:50% auto auto 50%;z-index:10;transform:translate(-50%,-50%);width:min(88%,360px);padding:18px;border:1px solid #3b424c;background:#111419;box-shadow:10px 10px 0 #050607;text-align:center}.promotion>span{display:block;margin-bottom:12px;color:#89929d;font-size:10px;font-weight:900;letter-spacing:.14em}.promotion>div{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.promotion>div button{display:grid;place-items:center;aspect-ratio:1;border:1px solid #3b424c;background:#0b0d10;cursor:pointer}.promotion>div button:hover{border-color:#c1ff56}.promotion>div img{width:74%;height:74%;object-fit:contain}.promotion .cancel{margin-top:12px;border:0;background:transparent;color:#8e98a2;cursor:pointer}.chess-result-modal{position:absolute;z-index:20;inset:0;display:grid;place-items:center;padding:20px;background:#050708b8;backdrop-filter:blur(4px)}.result-card{width:min(88%,380px);padding:30px;border:1px solid #4a525d;background:#111419;box-shadow:12px 12px 0 #050607;text-align:center}.result-kicker{display:block;color:#89929d;font-size:10px;font-weight:900;letter-spacing:.18em}.result-card h2{margin:8px 0 4px;color:#f4f0e8;font-size:34px;line-height:1}.result-card p{margin:0 0 22px;color:#9ca6b1}.result-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.result-actions button,.result-actions a{display:grid;place-items:center;min-height:44px;border:1px solid #3b424c;background:#0b0d10;color:#f4f0e8;font:inherit;font-size:11px;font-weight:900;letter-spacing:.08em;text-decoration:none;text-transform:uppercase;cursor:pointer}.result-actions .play-again{border-color:#799b45;background:#c1ff56;color:#10140c}.result-actions button:disabled{opacity:.5;cursor:default}@media(max-width:640px){.chess-board{border-width:6px}.piece{width:80%;height:80%}.chess-cell.selected{box-shadow:inset 0 0 0 3px #c1ff56}.result-actions{grid-template-columns:1fr}}
</style>
