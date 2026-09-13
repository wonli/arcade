function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function pickRandom(items, random) {
  if (!items.length) return null
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

export function createChapterPlan(chapter = 1, random = Math.random) {
  const length = 4 + Math.floor(random() * 5)
  const plan = Array.from({ length }, () => 'combat')
  plan[length - 1] = 'boss'

  const eliteTarget = Math.min(2, Math.floor((length - 2) / 3) + (chapter >= 4 ? 1 : 0))
  const eliteCandidates = Array.from({ length: Math.max(0, length - 2) }, (_, index) => index + 1)

  for (let i = 0; i < eliteTarget && eliteCandidates.length; i++) {
    const chosen = pickRandom(eliteCandidates, random)
    if (chosen == null) break
    plan[chosen] = 'elite'
    eliteCandidates.splice(eliteCandidates.indexOf(chosen), 1)
  }

  const restCandidates = []
  for (let i = 1; i < length - 2; i++) {
    if (plan[i] === 'combat') restCandidates.push(i)
  }
  if (random() < 0.65 && restCandidates.length) {
    const index = pickRandom(restCandidates, random)
    if (index != null) plan[index] = 'rest'
  }

  const treasureCandidates = []
  for (let i = 1; i < length - 2; i++) {
    if (plan[i] === 'combat') treasureCandidates.push(i)
  }
  if (treasureCandidates.length && random() < 0.55) {
    const index = pickRandom(treasureCandidates, random)
    if (index != null) plan[index] = 'treasure'
  }

  if (length >= 4) plan[length - 2] = 'antechamber'
  return plan
}

export function roomRoleAt(progress) {
  return progress?.chapterPlan?.[Math.max(0, (progress.chapterFloor ?? 1) - 1)] ?? 'combat'
}

export function createRunProgress(random = Math.random) {
  const chapterPlan = createChapterPlan(1, random)
  return {
    floor: 1,
    chapter: 1,
    chapterFloor: 1,
    chapterLength: chapterPlan.length,
    chapterPlan,
    roomRole: chapterPlan[0],
  }
}

export function advanceProgress(progress, random = Math.random) {
  if ((progress.chapterFloor ?? 1) >= (progress.chapterPlan?.length ?? progress.chapterLength ?? 1)) {
    const chapter = (progress.chapter ?? 1) + 1
    const chapterPlan = createChapterPlan(chapter, random)
    return {
      floor: (progress.floor ?? 1) + 1,
      chapter,
      chapterFloor: 1,
      chapterLength: chapterPlan.length,
      chapterPlan,
      roomRole: chapterPlan[0],
    }
  }

  const next = {
    ...progress,
    floor: (progress.floor ?? 1) + 1,
    chapterFloor: (progress.chapterFloor ?? 1) + 1,
  }
  next.roomRole = roomRoleAt(next)
  return next
}

export function difficultyProfile({ floor = 1, chapter = 1, roomRole = 'combat' } = {}) {
  const depth = Math.max(0, floor - 1)
  const chapterDepth = Math.max(0, chapter - 1)
  const roleHp = roomRole === 'elite' ? 1.28 : roomRole === 'boss' ? 1.7 : roomRole === 'antechamber' ? 0.88 : 1
  const roleDamage = roomRole === 'elite' ? 1.2 : roomRole === 'boss' ? 1.35 : 1
  const roleWave = roomRole === 'elite' ? 2 : roomRole === 'boss' ? -4 : roomRole === 'antechamber' ? -2 : 0

  return {
    hpMultiplier: (1 + depth * 0.075 + chapterDepth * 0.04) * roleHp,
    damageMultiplier: (1 + depth * 0.042 + chapterDepth * 0.025) * roleDamage,
    speedMultiplier: clamp(1 + depth * 0.006, 1, 1.45),
    waveCount: clamp(5 + Math.floor(depth / 3) + roleWave, roomRole === 'boss' ? 1 : 3, 14),
    eliteCount: roomRole === 'elite' ? clamp(2 + Math.floor(chapter / 3), 2, 5) : clamp(Math.floor(chapter / 5), 0, 2),
    bossHpMultiplier: clamp(1 + chapterDepth * 0.24, 1, 4.6),
    bossDamageMultiplier: clamp(1 + chapterDepth * 0.12, 1, 2.8),
    bossCooldownMultiplier: clamp(1 - chapterDepth * 0.035, 0.58, 1),
  }
}
