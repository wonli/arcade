<script>
  import { createEventDispatcher } from 'svelte'
  import { joystickVector } from '$lib/games/touch/joystick.js'

  export let deadzone = 0.12
  export let travel = 34
  export let disabled = false
  export let className = ''

  const dispatch = createEventDispatcher()
  let knobX = 0
  let knobY = 0

  function emitMove(event) {
    if (disabled) return
    event.preventDefault()
    const vector = joystickVector(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), { deadzone })
    knobX = vector.x * travel
    knobY = vector.y * travel
    dispatch('move', vector)
  }

  function start(event) {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    emitMove(event)
  }

  function stop(event) {
    event.preventDefault()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId)
    knobX = 0
    knobY = 0
    dispatch('move', { x: 0, y: 0 })
    dispatch('end')
  }
</script>

<div
  class={`virtual-joystick ${className}`}
  class:disabled
  role="presentation"
  on:pointerdown={start}
  on:pointermove={emitMove}
  on:pointerup={stop}
  on:pointercancel={stop}
  on:contextmenu={(event) => event.preventDefault()}
>
  <div class="joystick-ring"></div>
  <div class="joystick-knob" style={`transform: translate(${knobX}px, ${knobY}px)`}></div>
</div>

<style>
  .virtual-joystick{
    position:relative;
    width:132px;
    height:132px;
    border-radius:50%;
    pointer-events:auto;
    touch-action:none;
    user-select:none;
    -webkit-user-select:none;
    -webkit-touch-callout:none;
    overscroll-behavior:contain;
  }
  .virtual-joystick.disabled{pointer-events:none;opacity:.5}
  .joystick-ring{position:absolute;inset:10px;border:2px solid rgba(193,255,86,.34);border-radius:50%;background:rgba(8,10,13,.38);box-shadow:inset 0 0 24px rgba(0,0,0,.38);pointer-events:none}
  .joystick-knob{position:absolute;left:43px;top:43px;width:46px;height:46px;border-radius:50%;background:rgba(193,255,86,.78);border:2px solid rgba(244,240,232,.86);box-shadow:0 6px 18px rgba(0,0,0,.38);will-change:transform;pointer-events:none}
  @media(max-width:720px){
    .virtual-joystick{width:118px;height:118px}
    .joystick-ring{inset:8px}
    .joystick-knob{left:38px;top:38px;width:42px;height:42px}
  }
</style>
