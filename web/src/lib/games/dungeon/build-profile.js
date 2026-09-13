const BUILDS = [
  { id: 'lightning', label: 'Lightning', wants: ['thunder', 'chain'], affinity: { dagger: 1, sword: 1.08, katana: 0.96 } },
  { id: 'reaper', label: 'Reaper', wants: ['executioner', 'corpse_burst'], affinity: { dagger: 0.92, sword: 1, katana: 1.12 } },
  { id: 'blood-rush', label: 'Blood Rush', wants: ['life_steal', 'critical_heal', 'attack_speed'], affinity: { dagger: 1.16, sword: 1, katana: 0.88 } },
  { id: 'tempest', label: 'Tempest', wants: ['whirlwind', 'skill_radius', 'skill_haste'], affinity: { dagger: 0.96, sword: 1.1, katana: 1.02 } },
  { id: 'berserker', label: 'Berserker', wants: ['berserker', 'low_health_damage'], affinity: { dagger: 1.04, sword: 1, katana: 1.12 } },
]

export function buildAffinity(buildId, archetype = 'sword') {
  return BUILDS.find((build) => build.id === buildId)?.affinity?.[archetype] ?? 1
}

export function classifyBuild(item = {}) {
  const ids = new Set((item.affixes ?? []).map((entry) => entry.id))
  let best = null
  for (const build of BUILDS) {
    const matches = build.wants.reduce((count, id) => count + (ids.has(id) ? 1 : 0), 0)
    const score = matches * buildAffinity(build.id, item.archetype)
    if (!best || score > best.score) best = { ...build, matches, score }
  }
  return best?.matches ? { id: best.id, label: best.label, matches: best.matches, score: Number(best.score.toFixed(2)) } : { id: 'open', label: 'Open Build', matches: 0, score: 0 }
}

export function buildHint(item) {
  const build = classifyBuild(item)
  return build.id === 'open' ? '' : `${build.label} ${build.matches}/${BUILDS.find((entry) => entry.id === build.id).wants.length}`
}
