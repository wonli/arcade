export function normalizePoliceThiefRole(value) {
  return value === 'police' ? 'police' : 'thief'
}

export function buildPoliceThiefRoomPath({ players = 2, role = 'thief' } = {}) {
  const playerCount = Number(players) === 1 ? 1 : 2
  return `/room/new/policethief?players=${playerCount}&role=${normalizePoliceThiefRole(role)}`
}
