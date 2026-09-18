export interface WSResponse<T = any> {
  code: number;
  action: string;
  id?: string;
  msg?: string;
  data?: T;
}

export interface WSRequest<T = any> {
  id?: string;
  action: string;
  params?: T;
}

/**
 * 消息处理器类型
 */
export type WSMessageHandler<T = any> = (data: WSResponse<T>, ws: any) => void;

/**
 * 消息分发器映射
 */
export interface WSDispatcher {
  [action: string]: WSMessageHandler | WSDispatcher;
}

/**
 * server 服务器地址 ws://ip:port 或 wss://ip:port
 * config 连接配置
 * 参数
 *  reconnectLimit 最大重连次数
 *  reconnectInterval 重连间隔（秒）
 *
 * 回调方法
 *  dispatcher() 消息分发回调
 *  onConnect() 连接时
 *  onClose() 连接断开时
 */
let webSocket: Ws | null = null;

/**
 * WebSocket 配置接口
 */
export interface WSConfig {
  queue: WSRequest[];
  delay: number;
  callback: WSDispatcher;
  reconnect: boolean;
  reconnectCount: number;
  reconnectInterval: number;
  reconnectLimit: number;
  version: string;
  heartbeatInterval: number | null;
  onConnect: (ws: Ws, reconnectCount?: number) => void;
  onDisconnect: (ws: Ws, event?: CloseEvent) => void;
  onSendException: (error: Error) => void;
  onConnectError: (error: Event) => void;
  onRequest: (data: WSRequest, ws: Ws) => WSRequest | null;
  onResponse: (data: WSResponse) => boolean;
  onReconnectLimit: (ws: Ws) => void;
  onHeartbeat: (ws: Ws) => void;
  dispatcher: () => WSDispatcher;
  logger: (log: any) => void;
  pack: (data: WSRequest) => string | ArrayBuffer | Uint8Array;
  unpack: (data: string | ArrayBuffer | Uint8Array) => WSResponse | undefined;
  webSocketMessage: (event: MessageEvent) => void;
}

/**
 * 监听器项接口
 */
interface ListenerItem {
  id: string;
  listener: WSMessageHandler;
}

class Ws {
  config: WSConfig;
  sending: boolean = false;
  queueMap: Record<string, boolean> = {};
  callback: WSDispatcher;
  multiCallback: Record<string, (WSMessageHandler | ListenerItem)[]> = {};
  isConnected: boolean = false;
  isLogin: boolean = false;
  connect: WebSocket;
  globalParams: Record<string, any> = {};

  constructor(server: string, config: Partial<WSConfig> = {}) {
    this.config = Object.assign({
    queue: [],
    delay: 5,
    callback: {},
    reconnect: true,
    reconnectCount: 0,
    reconnectInterval: 3000,
    reconnectLimit: 10,
    version: 'v5.0',
    heartbeatInterval: null,
    onConnect () {
    },
    onDisconnect () {
    },
    onSendException () {
    },
    onConnectError (e: Event) {
      console.log(e)
    },
    onRequest (d: WSRequest, ws: Ws) {
      return d
    },
    onResponse (data: WSResponse) {
      return true
    },
    onReconnectLimit () {
    },
    onHeartbeat (ws: Ws) {
      // 清理之前的定时器
      if (ws.config.heartbeatInterval) {
        clearInterval(ws.config.heartbeatInterval)
      }

      // 每15秒发送一次"ping"消息
      ws.config.heartbeatInterval = setInterval(() => {
        ws.send('ping', () => {
        })
      }, 15000) as any
    },
    dispatcher () {
      new Error('请定义 dispatcher函数')
      return {}
    },
    logger (log: any) {
      console.log(log)
    },
    pack (res: WSRequest) {
      if (typeof res === 'object') {
        return JSON.stringify(res)
      }

      return res
    },
    unpack (res: string | ArrayBuffer | Uint8Array) {
      if (typeof res !== 'string') throw new Error('binary websocket payload requires a custom unpacker')
      return JSON.parse(res)
    },
    webSocketMessage (event: MessageEvent) {
    }
    }, config) as WSConfig;

    //回调对象
    this.callback = Object.assign(this.config.callback, this.config.dispatcher());
    //连接服务器
    this.connect = new WebSocket(server);
    this.connect.binaryType = 'arraybuffer';

    /**
     * 创建连接
     */
    this.connect.onopen = () => {
      webSocket = this;

      //打印版本号
      this.config.logger('Ws client ' + this.config.version);

      //连接时回调
      this.isConnected = true;
      this.config.onConnect(this, this.config.reconnectCount);

      // 连接成功后立即处理队列中的消息
      if (!this.sending && this.config.queue.length > 0) {
        this.sendQueue();
      }

      //客户端心跳
      this.config.onHeartbeat(this);

      //重置计数器
      this.config.reconnectCount = 0;

      //连接成功回调
      let fn = this.callbackHandler('.connect');
      if (fn) {
        fn({} as WSResponse, this as any);
      }
    };

    /**
     * 处理消息
     */
    this.connect.onmessage = (d: MessageEvent) => {
      this.config.webSocketMessage(d);
      let receive = this.config.unpack(d.data);
      if (receive === undefined) {
        throw new Error('unpack函数没有返回值');
      }

      if (!this.config.onResponse(receive)) {
        return;
      }

      // 处理单个回调
      let handler = this.callbackHandler(receive.action);
      if (handler) {
        handler(receive, this);
      }

      // 处理多个回调
      let multiHandlers = this.multiCallbackHandler(receive.action);
      if (multiHandlers && multiHandlers.length > 0) {
        multiHandlers.forEach(item => {
          // 处理带ID的监听器和普通监听器
          const callback = typeof item === 'function' ? item : item.listener;
          callback(receive, this);
        });
      }

      // room pub/sub 消息可能在页面 teardown 取消监听后晚到一个包。
      // 这是正常的订阅竞态，不应该让全局 websocket onmessage 抛错。
      if (!handler && (!multiHandlers || multiHandlers.length === 0)) {
        if (receive.action?.startsWith('room:')) {
          return;
        }
        throw new Error('未定义消息回调函数(' + receive.action + ')');
      }
    };

    /**
     * 链接失败时
     */
    this.connect.onerror = (e: Event) => {
      this.config.onConnectError(e);
    };

    /**
     * 重连处理
     */
    this.connect.onclose = (e: CloseEvent) => {
      //更新状态
      this.isConnected = false;

      //先执行用户回调
      this.config.onDisconnect(this, e);

      //断开时候保存回调和队列
      this.config.callback = this.callback;
      if (this.config.reconnect) {
        this.config.reconnectCount++;
        let id = setInterval(() => {
          if (this.config.reconnect) {
            clearInterval(id);
            if (this.config.heartbeatInterval) {
              clearInterval(this.config.heartbeatInterval);
            }
            new Ws(server, this.config);
          }
        }, this.config.reconnectInterval || 3000);

        if (this.config.reconnectCount >= this.config.reconnectLimit) {
          clearInterval(id);
          this.config.onReconnectLimit(this);
          this.config.logger('超出最大重试次数');
        }
      }
    };
  }

  /**
   * 发送消息
   */
  send(a: string, q?: any, c?: WSMessageHandler): void {
    //判断第二个参数是否为回调
    if (typeof q == 'function') {
      c = q
      q = {}
    }

    if (c) {
      this.on(a, c)
    }

    let standMsg = this.config.onRequest({
      action: a,
      params: Object.assign({}, this.globalParams, q)
    }, this)

    if (!standMsg) {
      return
    }

    if (webSocket?.connect?.readyState !== 1 || !webSocket.isConnected) {
      if (this.queueMap[a]) {
        return
      }

      //保存还未连接成功时的请求保存到队列
      this.queueMap[a] = true
      this.config.queue.unshift(standMsg)
    } else {
      this.config.queue.push(standMsg)
    }

    if (!this.sending) {
      this.sendQueue()
    }
  }

  /**
   * 发送消息（异步）
   */
  async sendAsync(a: string, q?: any): Promise<WSResponse> {
    return new Promise((resolve, reject) => {
      let standMsg = this.config.onRequest({
        action: a,
        params: Object.assign({}, this.globalParams, q)
      }, this)

      if (!standMsg) {
        return
      }

      this.on(a, d => {
        resolve(d)
      })

      if (webSocket?.connect?.readyState !== 1 || !webSocket.isConnected) {
        if (this.queueMap[a]) {
          return
        }

        this.queueMap[a] = true
        this.config.queue.unshift(standMsg)
      } else {
        this.config.queue.push(standMsg)
      }

      if (!this.sending) {
        this.sendQueue()
      }
    })
  }

  /**
   * 获取回调处理方法
   */
  callbackHandler(actions: string): WSMessageHandler | undefined {
    let a = actions.split('.'), item, callback = this.callback, isDefined = true
    while ((item = a.shift()) !== undefined) {
      if (!callback[item]) {
        isDefined = false
        break
      }

      callback = callback[item] as any
    }

    if (isDefined) {
      return callback as unknown as WSMessageHandler
    }

    return undefined
  }

  /**
   * 获取多回调处理方法
   */
  multiCallbackHandler(actions: string): (WSMessageHandler | ListenerItem)[] | undefined {
    return this.multiCallback[actions] || undefined
  }

  /**
   * 添加到调用链
   */
  on(actions: string, handler: WSMessageHandler): void {
    let chains = actions.split('.')
    let n = 0, m = chains.length, a = this.callback
    for (let i of chains) {
      n++
      if (!a[i]) {
        if (n === m) {
          a[i] = handler
        } else {
          a[i] = {} as any
        }

        a = a[i] as any
      } else {
        if (n === m) {
          a[i] = handler
        } else {
          a = a[i] as any
        }
      }
    }
  }

  /**
   * 为一个action添加监听器
   */
  addListener(id: string | WSMessageHandler, actions?: string | WSMessageHandler, listener?: WSMessageHandler): boolean {
    // 参数处理：如果只有两个参数，第一个是actions，第二个是listener
    if (typeof listener === 'undefined') {
      listener = actions as WSMessageHandler
      actions = id as string
      id = null as any
    }

    if (!this.multiCallback[actions as string]) {
      this.multiCallback[actions as string] = []
    }

    // 检查重复
    if (id) {
      // 基于ID检查重复
      const existsId = this.multiCallback[actions as string].some(item =>
        typeof item === 'object' && item.id === id
      )
      if (existsId) {
        console.warn(`监听器ID "${id}" 已存在于 action "${actions}"，跳过重复注册`)
        return false
      }
      // 添加带ID的监听器
      this.multiCallback[actions as string].push({ id: id as string, listener: listener as WSMessageHandler })
    } else {
      // 基于函数引用检查重复
      const existingListener = this.multiCallback[actions as string].find(item => {
        return typeof item === 'function' ? item === listener : item.listener === listener
      })
      if (existingListener) {
        console.warn(`监听器函数已存在于 action "${actions}"，跳过重复注册`)
        return false
      }
      // 添加普通监听器
      this.multiCallback[actions as string].push(listener as WSMessageHandler)
    }

    return true
  }

  removeListener(id: string, actions: string): void {
    const listeners = this.multiCallback[actions];
    if (!listeners) return;
    this.multiCallback[actions] = listeners.filter(item =>
      typeof item === 'function' || item.id !== id
    );
    if (this.multiCallback[actions].length === 0) delete this.multiCallback[actions];
  }

  /**
   * 发送队列
   */
  sendQueue(): void {
    if (webSocket?.connect?.readyState !== 1 || !webSocket.isConnected) {
      return
    }

    this.sending = true
    let msg = this.config.queue.pop()
    if (msg === undefined) {
      this.sending = false
      return
    }

    if (msg.action && msg.params) {
      try {
        webSocket.connect.send(this.config.pack(msg))
      }
      catch (e) {
        this.config.logger(e)
        this.config.onSendException(e as Error)
      }
    }

    this.delay(this.config.delay).then(() => {
      this.sendQueue()
    })
  }

  /**
   * 服务器是否在线
   */
  canConnect(): boolean {
    return this.isConnected
  }

  /**
   * 关闭连接
   */
  closeConnect(): void {
    webSocket?.connect?.close()
    this.isConnected = false
  }

  /**
   * 关闭重连
   */
  disableReconnect(): void {
    this.config.reconnect = false
  }

  /**
   * 是否允许重连
   */
  canReconnect(): boolean {
    return this.config.reconnect
  }

  /**
   * 开启重连
   */
  enableReconnect(): void {
    this.config.reconnect = true
  }

  /**
   * 延迟执行
   * @param ms
   * @returns {Promise<unknown>}
   */
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default Ws
