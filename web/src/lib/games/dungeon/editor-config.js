const ENDPOINT = '/api/dungeon/config/weapon-presentation'

async function decode(response) {
  if (!response?.ok) {
    const text = await response?.text?.()
    throw new Error(text || `request failed: ${response?.status ?? 'unknown'}`)
  }
  return response.json()
}

export function createDungeonEditorConfigClient(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable')
  return {
    async load() {
      return decode(await fetchImpl(ENDPOINT))
    },
    async save(config) {
      return decode(await fetchImpl(ENDPOINT, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      }))
    },
    async reset() {
      return decode(await fetchImpl(ENDPOINT, { method: 'DELETE' }))
    },
  }
}

export { ENDPOINT as DUNGEON_WEAPON_PRESENTATION_ENDPOINT }
