<script>
  import { onMount } from 'svelte'
  import Home from './Home.svelte'
  import Room from './Room.svelte'

  let hash = window.location.hash || '#/'

  function syncRoute() {
    hash = window.location.hash || '#/'
  }

  function roomCode() {
    const match = hash.match(/^#\/room\/([^?]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  onMount(() => {
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  })
</script>

<svelte:head>
  <meta name="description" content="AQI Arcade — tiny multiplayer games powered by AQI realtime." />
</svelte:head>

{#if roomCode()}
  <Room code={roomCode()} />
{:else}
  <Home />
{/if}
