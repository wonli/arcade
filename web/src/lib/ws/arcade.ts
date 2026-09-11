import Ws, { type WSResponse } from './wslib'

type ConnectionListener = (state: 'live' | 'offline') => void
type MessageListener = (message: WSResponse) => void

function wsURL() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/ws`
}

class ArcadeSocket {
  private ws: Ws | null = null
  private connecting: Promise<void> | null = null
  private connectionListeners = new Set<ConnectionListener>()
  private listenerID = 0

  connect(): Promise<void> {
    if (this.ws?.canConnect()) return Promise.resolve()
    if (this.connecting) return this.connecting

    this.connecting = new Promise((resolve, reject) => {
      let opened = false
      let client: Ws

      client = new Ws(wsURL(), {
        reconnect: false,
        logger: () => {},
        dispatcher: () => ({}),
        onConnect: () => {
          opened = true
          this.ws = client
          this.connecting = null
          this.emitConnection('live')
          resolve()
        },
        onDisconnect: () => {
          if (this.ws === client) this.ws = null
          this.emitConnection('offline')
        },
        onConnectError: () => {
          if (!opened) {
            this.connecting = null
            reject(new Error('websocket connection failed'))
          }
        },
      })

      this.ws = client
    })

    return this.connecting
  }

  async request(action: string, params: Record<string, any> = {}) {
    if (!this.ws?.canConnect()) {
      throw new Error('websocket is not connected')
    }

    const response = await this.ws.sendAsync(action, params)
    if (response.code && response.code !== 0) {
      throw new Error(response.msg || `request failed: ${response.code}`)
    }
    return response.data
  }

  subscribe(action: string, listener: MessageListener) {
    if (!this.ws) throw new Error('websocket is not connected')

    const target = this.ws
    const id = `arcade-${++this.listenerID}`
    target.addListener(id, action, (message) => listener(message))
    return () => target.removeListener(id, action)
  }

  onConnection(listener: ConnectionListener) {
    this.connectionListeners.add(listener)
    return () => this.connectionListeners.delete(listener)
  }

  close() {
    this.ws?.disableReconnect()
    this.ws?.closeConnect()
    this.ws = null
    this.connecting = null
  }

  private emitConnection(state: 'live' | 'offline') {
    for (const listener of this.connectionListeners) listener(state)
  }
}

export const socket = new ArcadeSocket()
