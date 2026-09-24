<script>
  import { onMount } from 'svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import { socket } from '$lib/ws/arcade'
  import TankArena from '$lib/games/tank/TankArena.svelte'

  export let data

  const identity = getIdentity()
  const name = defaultName(identity.playerId)
  let roomCode = (data?.code ?? '').toUpperCase()
  let room = null
  let connection = 'connecting'
  let error = ''
  let locale = 'en'
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let unsubscribeLocale = () => {}

  $: t = createTranslator(locale)

  function applySnapshot(snapshot) {
    if (!snapshot || snapshot.type) return
    room = snapshot
  }

  function subscribeRoom() {
    unsubscribeRoom()
    const topic = `room:${roomCode}`
    unsubscribeRoom = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      applySnapshot(message.data.message)
    })
  }

  async function bootstrap() {
    error = ''
    connection = 'connecting'
    await socket.connect()
    await socket.request('arcade.login', { playerId: identity.sessionId, sessionId: identity.sessionId })

    if (roomCode === 'NEW') {
      const snapshot = await socket.request('room.create', { game: 'tank', name, players: 2 })
      applySnapshot(snapshot)
      roomCode = snapshot.id
      history.replaceState(null, '', `/room/${roomCode.toLowerCase()}/tank`)
    } else {
      const snapshot = await socket.request('room.join', { roomId: roomCode, name })
      if (snapshot.game !== 'tank') {
        location.replace(`/room/${roomCode.toLowerCase()}/${snapshot.game}`)
        return
      }
      applySnapshot(snapshot)
    }

    subscribeRoom()
    connection = 'live'
  }

  async function reconnect() {
    try { await bootstrap() }
    catch (cause) { connection = 'offline'; error = cause.message }
  }

  function connectionLabel() {
    if (connection === 'live') return t('common.live')
    if (connection === 'offline') return locale === 'zh-CN' ? '离线' : 'OFFLINE'
    return locale === 'zh-CN' ? '连接中' : 'CONNECTING'
  }

  onMount(() => {
    unsubscribeLocale = subscribeLocale((next) => (locale = next))
    unsubscribeConnection = socket.onConnection((state) => (connection = state))
    bootstrap().catch((cause) => { connection = 'offline'; error = cause.message })
    return () => {
      unsubscribeRoom()
      unsubscribeConnection()
      unsubscribeLocale()
    }
  })
</script>

<svelte:head><title>{t('game.tank.name')} · {roomCode.toLowerCase()} · AQI Arcade</title></svelte:head>

<div class="room-shell tank-room-shell">
  <header class="room-topbar">
    <a class="brand" href="/"><span class="brand-mark">A</span><span>AQI ARCADE</span></a>
    <div class="room-meta"><span>{t('game.tank.name')} · <strong>{roomCode.toLowerCase()}</strong></span><span class:offline={connection!=='live'} class="live-badge"><i></i>{connectionLabel()}</span></div>
  </header>
  <main class="room-main tank-main">
    {#if room}
      <TankArena {room} {roomCode} {identity} {socket} />
    {:else if connection !== 'offline'}
      <div class="booting">{locale === 'zh-CN' ? '正在进入坦克战场…' : 'ENTERING TANK BATTLE…'}</div>
    {/if}
    {#if error}<div class="room-error standalone-error">{error}</div>{/if}
    {#if connection === 'offline'}<button class="secondary-button reconnect" onclick={reconnect}>{t('common.reconnect')}</button>{/if}
  </main>
</div>

<style>
  .tank-room-shell{min-height:100dvh}.tank-main{display:block;padding-top:28px;padding-bottom:36px}.booting{min-height:55vh;display:grid;place-items:center;color:#727c87;font:900 12px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.standalone-error{width:min(100%,1180px);margin:16px auto 0}.reconnect{display:block;margin:14px auto 0}
</style>
