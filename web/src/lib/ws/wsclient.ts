import { browser } from '$app/environment'
import type { WSConfig } from './wslib'
import { onConnect, onDisconnect, onReconnectLimit, onRequest, onResponse, onConnectError } from '$lib/api/ws/modules/event'
import { ping, showCaptcha, loginInit } from '$lib/api/ws/modules/common'
import { subscriber } from '$lib/api/ws/modules/subscribe'
import { wsUrl } from '$lib/api/ws/environment'
import Ws from './wslib'


const dispatcher = {
  onConnect,
  onDisconnect,
  onRequest,
  onResponse,
  onReconnectLimit,
  onConnectError,
  reconnectInterval: 5000,
  reconnectLimit: 200,
  dispatcher: () => {
    return {
      ping, showCaptcha, loginInit, subscriber,
    }
  }
}

// 只在浏览器环境中创建 WebSocket 客户端
const wsclient = browser ? new Ws(wsUrl, dispatcher) : null;

/**
 * 获取 WebSocket 客户端（非空断言）
 * 仅在浏览器环境调用，SSR 环境下抛出异常
 */
export function getWs(): Ws {
  if (!wsclient) throw new Error('WebSocket client is not available (SSR)');
  return wsclient;
}

export default wsclient;
export type { WSConfig };

