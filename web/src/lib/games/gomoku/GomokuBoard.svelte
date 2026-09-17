<script>
  let {
    state = null,
    interactive = false,
    canMove = () => false,
    onMove = () => {},
    boardLabel = 'Gomoku board',
    placeLabel = (x, y) => `Place stone at ${x + 1}, ${y + 1}`,
  } = $props()

  const size = 15
  const cells = Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: Math.floor(index / size),
  }))

  function stoneAt(x, y) {
    return state?.board?.[y]?.[x] ?? 0
  }

  function isLast(x, y) {
    return state?.last?.x === x && state?.last?.y === y
  }

  function playable(x, y) {
    return interactive && canMove(x, y)
  }

  function choose(x, y) {
    if (!playable(x, y)) return
    onMove(x, y)
  }
</script>

<div class="gomoku-board" aria-label={boardLabel}>
  {#each cells as cell}
    <button
      class="board-cell"
      class:last={isLast(cell.x, cell.y)}
      class:playable={playable(cell.x, cell.y)}
      onclick={() => choose(cell.x, cell.y)}
      aria-label={placeLabel(cell.x, cell.y)}
      tabindex={interactive ? 0 : -1}
    >
      {#if stoneAt(cell.x, cell.y) === 1}
        <span class="stone stone-black"></span>
      {:else if stoneAt(cell.x, cell.y) === 2}
        <span class="stone stone-white"></span>
      {:else if interactive}
        <span class="ghost-stone"></span>
      {/if}
    </button>
  {/each}
</div>
