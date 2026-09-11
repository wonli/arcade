export class AqiSocket {
  constructor(path = '/ws') {
    this.path = path
    this.socket = null
    this.pending = new Map()
    this.listeners = new Set()
    this.sequence = 0
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${location.host}${this.path}`)
      this.socket = socket

      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error('websocket connection failed'))
      socket.onclose = () => {
        for (const { reject } of this.pending.values()) {
          reject(new Error('websocket disconnected'))
        }
        this.pending.clear()
        this.emit({ type: 'connection', state: 'closed' })
      }
      socket.onmessage = (event) => this.handleMessage(event.data)
    })
  }

  request(action, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('websocket is not connected'))
    }

    const id = `${Date.now().toString(36)}-${++this.sequence}`
    const payload = JSON.stringify({ id, action, params })

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(payload)
    })
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  close() {
    this.socket?.close()
  }

  handleMessage(raw) {
    let message
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }

    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.code && message.code !== 0) {
        pending.reject(new Error(message.msg || `request failed: ${message.code}`))
      } else {
        pending.resolve(message.data)
      }
      return
    }

    this.emit({ type: 'message', message })
  }

  emit(event) {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const socket = new AqiSocket()
