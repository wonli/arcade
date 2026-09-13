<script>
  export let room
  export let state
  export let identity
  export let onMove

  const whitePieces = ['','♙','♘','♗','♖','♕','♔']
  const blackPieces = ['','♟','♞','♝','♜','♛','♚']
  const baseCells = Array.from({ length: 64 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8) }))

  let selected = null
  let pendingPromotion = null
  let observedPly = -1

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

  function pieceAt(x, y) {
    return state?.board?.[y]?.[x] ?? 0
  }

  function pieceGlyph(piece) {
    if (piece > 0) return whitePieces[piece] ?? ''
    if (piece < 0) return blackPieces[-piece] ?? ''
    return ''
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
</script>

<div class="chess-wrap">
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
          <span class:white-piece={pieceAt(cell.x, cell.y) > 0} class:black-piece={pieceAt(cell.x, cell.y) < 0} class="piece">{pieceGlyph(pieceAt(cell.x, cell.y))}</span>
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
        <button onclick={() => promoteTo('q')}>{myColor === 'black' ? '♛' : '♕'}</button>
        <button onclick={() => promoteTo('r')}>{myColor === 'black' ? '♜' : '♖'}</button>
        <button onclick={() => promoteTo('b')}>{myColor === 'black' ? '♝' : '♗'}</button>
        <button onclick={() => promoteTo('n')}>{myColor === 'black' ? '♞' : '♘'}</button>
      </div>
      <button class="cancel" onclick={() => (pendingPromotion = null)}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .chess-wrap{position:relative;width:min(100%,720px);margin:auto}.chess-board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;border:10px solid #171b20;box-shadow:0 18px 50px #0008,0 0 0 1px #343a42}.chess-cell{position:relative;display:grid;place-items:center;min-width:0;aspect-ratio:1;border:0;padding:0;cursor:default;font:inherit}.chess-cell.light{background:#d9d1bd}.chess-cell.dark{background:#68745d}.chess-cell.last{box-shadow:inset 0 0 0 999px #c1ff5630}.chess-cell.selected{box-shadow:inset 0 0 0 4px #c1ff56}.chess-cell.target{cursor:pointer}.chess-cell.target:after{content:'';position:absolute;width:28%;aspect-ratio:1;border:2px solid #c1ff56;border-radius:50%;opacity:.85}.chess-cell.capture:after{width:72%;border-width:4px;background:transparent}.piece{position:relative;z-index:2;font-size:clamp(30px,7.8vw,66px);line-height:1;transform:translateY(-2%);font-family:'Times New Roman','Noto Sans Symbols 2',serif;user-select:none;filter:drop-shadow(0 2px 1px #0005)}.white-piece{color:#fff9e8;text-shadow:0 1px 0 #222,1px 0 0 #222,0 -1px 0 #222,-1px 0 0 #222}.black-piece{color:#151719;text-shadow:0 1px 0 #ffffff70}.move-dot{width:18%;aspect-ratio:1;border-radius:50%;background:#c1ff56;box-shadow:0 0 0 4px #0b0d1025}.rank,.file{position:absolute;z-index:3;font-size:9px;font-weight:900;opacity:.7;pointer-events:none}.rank{top:4px;left:5px}.file{right:5px;bottom:3px}.dark .rank,.dark .file{color:#e9e1d0}.light .rank,.light .file{color:#4d5746}.promotion{position:absolute;inset:50% auto auto 50%;z-index:10;transform:translate(-50%,-50%);width:min(88%,360px);padding:18px;border:1px solid #3b424c;background:#111419;box-shadow:10px 10px 0 #050607;text-align:center}.promotion>span{display:block;margin-bottom:12px;color:#89929d;font-size:10px;font-weight:900;letter-spacing:.14em}.promotion>div{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.promotion>div button{aspect-ratio:1;border:1px solid #3b424c;background:#0b0d10;color:#f4f0e8;font-size:38px;cursor:pointer}.promotion>div button:hover{border-color:#c1ff56}.promotion .cancel{margin-top:12px;border:0;background:transparent;color:#8e98a2;cursor:pointer}@media(max-width:640px){.chess-board{border-width:6px}.piece{font-size:clamp(28px,10vw,50px)}.chess-cell.selected{box-shadow:inset 0 0 0 3px #c1ff56}}
</style>
