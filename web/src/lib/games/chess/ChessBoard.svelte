<script>
  import { onDestroy } from 'svelte'
  import { chessPieceGlyph } from './pieces.js'
  import { chessAudioSources, chessMoveEffect } from './audio.js'

  export let room
  export let state
  export let identity
  export let onMove

  const baseCells = Array.from({ length: 64 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8) }))

  let selected = null
  let pendingPromotion = null
  let observedPly = -1
  let observedAudioPly = -1
  let previousAudioState = null
  let audioUnlocked = false
  let bgm = null
  let moveAudio = null
  let captureAudio = null

  $: myIndex = room?.players?.findIndex((player) => player.id === identity.sessionId) ?? -1
  $: myColor = myIndex === 0 ? 'white' : myIndex === 1 ? 'black' : ''
  $: flipped = myColor === 'black'
  $: cells = flipped ? [...baseCells].reverse() : baseCells
  $: myTurn = state?.status === 'playing' && state?.turn === myColor
  $: if ((state?.ply ?? -1) !== observedPly) {
    observedPly = state?.ply ?? -1
    selected = null
    pendingPromotion = null
  }
  $: if (state && (state.ply ?? -1) !== observedAudioPly) {
    const effect = chessMoveEffect(previousAudioState, state)
    if (effect) playChessEffect(effect)
    previousAudioState = snapshotAudioState(state)
    observedAudioPly = state.ply ?? -1
    if (state.status === 'finished') bgm?.pause()
  }

  function snapshotAudioState(value) {
    return {
      ply: value?.ply ?? -1,
      board: value?.board?.map((row) => [...row]) ?? []
    }
  }

  function ensureAudio() {
    if (typeof window === 'undefined') return
    if (!bgm) {
      bgm = new Audio(chessAudioSources.bgm)
      bgm.loop = true
      bgm.preload = 'auto'
      bgm.volume = 0.12
    }
    if (!moveAudio) {
      moveAudio = new Audio(chessAudioSources.move)
      moveAudio.preload = 'auto'
      moveAudio.volume = 0.55
    }
    if (!captureAudio) {
      captureAudio = new Audio(chessAudioSources.capture)
      captureAudio.preload = 'auto'
      captureAudio.volume = 0.62
    }
  }

  function unlockAudio() {
    if (typeof window === 'undefined') return
    audioUnlocked = true
    ensureAudio()
    if (bgm?.paused && state?.status !== 'finished') bgm.play().catch(() => {})
  }

  function playChessEffect(effect) {
    if (!audioUnlocked) return
    ensureAudio()
    const audio = effect === 'capture' ? captureAudio : moveAudio
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  function pieceAt(x, y) {
    return state?.board?.[y]?.[x] ?? 0
  }

  function pieceColor(piece) {
    if (piece > 0) return 'white'
    if (piece < 0) return 'black'
    return ''
  }

  function legalFrom(x, y) {
    return (state?.legalMoves ?? []).filter((move) => move.from.x === x && move.from.y === y)
  }

  function legalTo(x, y) {
    if (!selected) return []
    return legalFrom(selected.x, selected.y).filter((move) => move.to.x === x && move.to.y === y)
  }

  function isLegalTarget(x, y) {
    return legalTo(x, y).length > 0
  }

  function isLastSquare(x, y) {
    const last = state?.last
    return !!last && ((last.from.x === x && last.from.y === y) || (last.to.x === x && last.to.y === y))
  }

  function chooseSquare(x, y) {
    unlockAudio()
    if (!myTurn || pendingPromotion) return
    const piece = pieceAt(x, y)

    if (selected) {
      const targets = legalTo(x, y)
      if (targets.length > 0) {
        const promotions = [...new Set(targets.map((move) => move.promotion).filter(Boolean))]
        if (promotions.length > 1) {
          pendingPromotion = { moves: targets, x, y }
          return
        }
        submit(targets[0])
        return
      }
    }

    if (pieceColor(piece) === myColor && legalFrom(x, y).length > 0) {
      selected = { x, y }
    } else {
      selected = null
    }
  }

  async function submit(move) {
    selected = null
    pendingPromotion = null
    await onMove?.(move)
  }

  function promoteTo(piece) {
    const move = pendingPromotion?.moves?.find((candidate) => candidate.promotion === piece)
    if (move) submit(move)
  }

  function fileLabel(x) {
    return String.fromCharCode(97 + x)
  }

  function rankLabel(y) {
    return String(8 - y)
  }

  onDestroy(() => {
    for (const audio of [bgm, moveAudio, captureAudio]) {
      if (!audio) continue
      audio.pause()
      audio.src = ''
    }
  })
</script>

<div class="chess-wrap" onpointerdown={unlockAudio}>
  <div class:flipped class="chess-board" aria-label="International chess board">
    {#each cells as cell}
      <button
        class="chess-cell"
        class:light={(cell.x + cell.y) % 2 === 0}
        class:dark={(cell.x + cell.y) % 2 === 1}
        class:selected={selected?.x === cell.x && selected?.y === cell.y}
        class:target={isLegalTarget(cell.x, cell.y)}
        class:capture={isLegalTarget(cell.x, cell.y) && pieceAt(cell.x, cell.y) !== 0}
        class:last={isLastSquare(cell.x, cell.y)}
        onclick={() => chooseSquare(cell.x, cell.y)}
        aria-label={`${fileLabel(cell.x)}${rankLabel(cell.y)}`}
      >
        {#if cell.x === (flipped ? 7 : 0)}<span class="rank">{rankLabel(cell.y)}</span>{/if}
        {#if cell.y === (flipped ? 0 : 7)}<span class="file">{fileLabel(cell.x)}</span>{/if}
        {#if pieceAt(cell.x, cell.y) !== 0}
          <span class:white-piece={pieceAt(cell.x, cell.y) > 0} class:black-piece={pieceAt(cell.x, cell.y) < 0} class="piece">{chessPieceGlyph(pieceAt(cell.x, cell.y))}</span>
        {:else if isLegalTarget(cell.x, cell.y)}
          <span class="move-dot"></span>
        {/if}
      </button>
    {/each}
  </div>

  {#if pendingPromotion}
    <div class="promotion" role="dialog" aria-label="Choose promotion piece">
      <span>PROMOTE TO</span>
      <div>
        <button onclick={() => promoteTo('q')}>♛</button>
        <button onclick={() => promoteTo('r')}>♜</button>
        <button onclick={() => promoteTo('b')}>♝</button>
        <button onclick={() => promoteTo('n')}>♞</button>
      </div>
      <button class="cancel" onclick={() => (pendingPromotion = null)}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .chess-wrap{position:relative;width:min(100%,720px);margin:auto}.chess-board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;border:10px solid #171b20;box-shadow:0 18px 50px #0008,0 0 0 1px #343a42}.chess-cell{position:relative;display:grid;place-items:center;min-width:0;aspect-ratio:1;border:0;padding:0;cursor:default;font:inherit}.chess-cell.light{background:#d9d1bd}.chess-cell.dark{background:#68745d}.chess-cell.last{box-shadow:inset 0 0 0 999px #c1ff5630}.chess-cell.selected{box-shadow:inset 0 0 0 4px #c1ff56}.chess-cell.target{cursor:pointer}.chess-cell.target:after{content:'';position:absolute;width:28%;aspect-ratio:1;border:2px solid #c1ff56;border-radius:50%;opacity:.85}.chess-cell.capture:after{width:72%;border-width:4px;background:transparent}.piece{position:relative;z-index:2;display:grid;place-items:center;width:82%;height:82%;font-size:clamp(32px,7.8vw,68px);line-height:1;transform:translateY(-1%);font-family:'Times New Roman','Noto Sans Symbols 2',serif;font-weight:400;user-select:none;-webkit-font-smoothing:antialiased}.white-piece{color:#fff7dc;text-shadow:-1px 0 #111,0 1px #111,1px 0 #111,0 -1px #111,0 3px 3px #0008}.black-piece{color:#111318;text-shadow:-1px 0 #f8efd8aa,0 1px #f8efd8aa,1px 0 #f8efd8aa,0 -1px #f8efd8aa,0 3px 3px #0006}.move-dot{width:18%;aspect-ratio:1;border-radius:50%;background:#c1ff56;box-shadow:0 0 0 4px #0b0d1025}.rank,.file{position:absolute;z-index:3;font-size:9px;font-weight:900;opacity:.7;pointer-events:none}.rank{top:4px;left:5px}.file{right:5px;bottom:3px}.dark .rank,.dark .file{color:#e9e1d0}.light .rank,.light .file{color:#4d5746}.promotion{position:absolute;inset:50% auto auto 50%;z-index:10;transform:translate(-50%,-50%);width:min(88%,360px);padding:18px;border:1px solid #3b424c;background:#111419;box-shadow:10px 10px 0 #050607;text-align:center}.promotion>span{display:block;margin-bottom:12px;color:#89929d;font-size:10px;font-weight:900;letter-spacing:.14em}.promotion>div{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.promotion>div button{aspect-ratio:1;border:1px solid #3b424c;background:#0b0d10;color:#f4f0e8;font-size:38px;cursor:pointer}.promotion>div button:hover{border-color:#c1ff56}.promotion .cancel{margin-top:12px;border:0;background:transparent;color:#8e98a2;cursor:pointer}@media(max-width:640px){.chess-board{border-width:6px}.piece{font-size:clamp(30px,10vw,54px)}.chess-cell.selected{box-shadow:inset 0 0 0 3px #c1ff56}}
</style>
