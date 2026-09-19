import { mount, unmount } from 'svelte'
import { writable } from 'svelte/store'

export function createSvelteReplayPlayer(target, recording, Component, {
  width,
  height,
  loopDelayMs = 700,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  componentOwnsTimeline = false,
} = {}) {
  if (!target) throw new Error('replay target is required')
  const frames = Array.isArray(recording?.frames) ? recording.frames : []
  if (!frames.length) throw new Error('replay has no frames')

  const host = document.createElement('div')
  host.className = 'native-replay-surface'
  if (Number.isFinite(width) && width > 0) host.style.width = `${width}px`
  if (Number.isFinite(height) && height > 0) host.style.height = `${height}px`
  Object.assign(host.style, {
    flex: '0 0 auto',
    position: 'relative',
    overflow: 'hidden',
  })
  target.replaceChildren(host)

  if (componentOwnsTimeline) {
    const component = mount(Component, { target: host, props: { recording } })
    return {
      destroy() {
        void unmount(component)
        host.remove()
      },
    }
  }

  const frameStore = writable(frames[0].state)
  const component = mount(Component, { target: host, props: { frameStore, recording } })
  let timer = null
  let destroyed = false
  let index = 0

  function renderCurrent() {
    if (destroyed) return
    frameStore.set(frames[index].state)
    const nextIndex = index + 1
    if (nextIndex < frames.length) {
      const delay = clamp(Number(frames[nextIndex].t) - Number(frames[index].t), 40, 2_000)
      timer = setTimeoutFn(() => {
        index = nextIndex
        renderCurrent()
      }, delay)
      return
    }
    timer = setTimeoutFn(() => {
      index = 0
      renderCurrent()
    }, loopDelayMs)
  }

  renderCurrent()

  return {
    destroy() {
      destroyed = true
      if (timer != null) clearTimeoutFn(timer)
      void unmount(component)
      host.remove()
    },
  }
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
