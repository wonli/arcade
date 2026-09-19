export async function fetchReplay(game, fetchFn = fetch) {
  const metaResponse = await fetchFn(`/api/game-replays/${encodeURIComponent(game)}`, { cache: 'no-store' })
  if (metaResponse.status === 404) return null
  if (!metaResponse.ok) throw new Error(`replay metadata failed: ${metaResponse.status}`)
  const metadata = await metaResponse.json()
  const dataResponse = await fetchFn(metadata.dataUrl, { cache: 'force-cache' })
  if (!dataResponse.ok) throw new Error(`replay data failed: ${dataResponse.status}`)
  return { metadata, bytes: new Uint8Array(await dataResponse.arrayBuffer()) }
}

export async function acquireReplayLease({ socket, roomId, game }) {
  return socket.request('replay.lease', { roomId, game })
}

export async function releaseReplayLease({ socket, game, lease }) {
  if (!lease) return false
  const response = await socket.request('replay.release', { game, lease })
  return response?.released === true
}

export async function uploadReplay({ game, lease, version, durationMs, players, hash, bytes, fetchFn = fetch }) {
  const response = await fetchFn(`/api/game-replays/${encodeURIComponent(game)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Arcade-Replay-Lease': lease,
      'X-Arcade-Replay-Version': String(version),
      'X-Arcade-Replay-Duration-Ms': String(durationMs),
      'X-Arcade-Replay-Players': String(players),
      'X-Arcade-Replay-Hash': hash,
    },
    body: bytes,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || `replay upload failed: ${response.status}`)
  }
  return response.json()
}
