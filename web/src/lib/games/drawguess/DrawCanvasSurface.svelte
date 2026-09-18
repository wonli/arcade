<script>
  import { mountCanvas } from './canvas.js'
  import { renderDrawState } from './draw-renderer.js'

  let {
    strokes = [],
    interactive = false,
    locked = false,
    label = 'Draw canvas',
    watchingLabel = '',
    onPointerDown = null,
    onPointerMove = null,
    onPointerUp = null,
    onPointerCancel = null,
    onReady = null,
    compact = false,
  } = $props()

  let canvas = $state(null)
  let context = $state(null)

  function canvasSurface(node) {
    return mountCanvas(node, {
      onReady(nextCanvas, nextContext) {
        canvas = nextCanvas
        context = nextContext
        renderDrawState(canvas, context, strokes)
        onReady?.(canvas, context)
      },
    })
  }

  $effect(() => {
    strokes
    if (canvas && context) renderDrawState(canvas, context, strokes)
  })
</script>

<div class:locked class:compact class="canvas-frame">
  <canvas
    bind:this={canvas}
    use:canvasSurface
    aria-label={label}
    onpointerdown={interactive ? onPointerDown : undefined}
    onpointermove={interactive ? onPointerMove : undefined}
    onpointerup={interactive ? onPointerUp : undefined}
    onpointercancel={interactive ? onPointerCancel : undefined}
  ></canvas>
  {#if locked && watchingLabel}<div class="watching">{watchingLabel}</div>{/if}
</div>

<style>
  .canvas-frame{position:relative;aspect-ratio:16/10;border:1px solid #30363f;background:#f7f4ed;box-shadow:10px 10px 0 #050607;touch-action:none}
  .canvas-frame canvas{display:block;width:100%;height:100%;cursor:crosshair;touch-action:none}
  .canvas-frame.locked canvas{cursor:default}
  .watching{position:absolute;right:12px;bottom:10px;padding:6px 8px;background:#0b0d10;color:#7f8791;font-size:8px;font-weight:900;letter-spacing:.14em;pointer-events:none}
  .canvas-frame.compact{width:960px;height:600px;aspect-ratio:auto;box-shadow:10px 10px 0 #050607}
</style>
