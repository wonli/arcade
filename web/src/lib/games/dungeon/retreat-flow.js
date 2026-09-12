export function createRetreatRequest({ onRequest, onConfirm, onCancel }) {
  return function requestRetreat() {
    let settled = false
    const settle = (action) => {
      if (settled) return false
      settled = true
      action?.()
      return true
    }

    const actions = {
      confirm: () => settle(onConfirm),
      cancel: () => settle(onCancel),
    }

    if (typeof onRequest !== 'function') {
      actions.cancel()
      return actions
    }

    onRequest(actions)
    return actions
  }
}
