<script>
  import '../styles.css'
  import '../room.css'
  import { page } from '$app/stores'
  import ArcadeTopNav from '$lib/components/ArcadeTopNav.svelte'

  function resolveNav(pathname) {
    if (pathname === '/') return { show: true, game: '', room: '' }
    if (pathname === '/dungeon') return { show: true, game: 'dungeon', room: '' }

    const roomMatch = pathname.match(/^\/room\/([^/]+)\/([^/]+)(?:\/|$)/)
    if (roomMatch) {
      return {
        show: true,
        room: roomMatch[1],
        game: roomMatch[2],
      }
    }

    return { show: false, game: '', room: '' }
  }

  $: nav = resolveNav($page.url.pathname)
</script>

{#if nav.show}
  <div class="arcade-shell">
    <ArcadeTopNav game={nav.game} room={nav.room} />
    <div class="arcade-content"><slot /></div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .arcade-shell{height:100dvh;min-height:0;display:grid;grid-template-rows:44px minmax(0,1fr);overflow:hidden;background:#0b0d10}
  .arcade-content{min-height:0;overflow:auto;overscroll-behavior:contain}

  :global(.arcade-content > .home){height:100%!important;min-height:0!important;grid-template-rows:minmax(0,1fr)!important}
  :global(.arcade-content > .home > .home-nav){display:none!important}

  :global(.arcade-content > .room-shell){min-height:100%!important}
  :global(.arcade-content .room-topbar){display:none!important}
  :global(.arcade-content .room-main){padding-top:24px}

  :global(.arcade-content > .page){height:100%!important;min-height:0!important}
  :global(.arcade-content > .page > .topbar){height:0!important;min-height:0!important;position:relative;z-index:90}
  :global(.arcade-content > .page > .topbar .title-copy),
  :global(.arcade-content > .page > .topbar .actions){display:none!important}

  :global(.arcade-content > .page > header:not(.topbar) > div:first-child > a){display:none!important}
  :global(.arcade-content > .page > header:not(.topbar) .players button:first-of-type){display:none!important}

  @media(max-width:640px){
    .arcade-shell{grid-template-rows:40px minmax(0,1fr)}
    :global(.arcade-content .room-main){padding-top:16px}
  }
</style>
