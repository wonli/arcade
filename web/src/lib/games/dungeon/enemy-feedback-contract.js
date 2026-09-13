export function sourceKeepsEnemyVisibleOnDeath(source = '') {
  const killEnemy = String(source).match(/killEnemy\s*\([^)]*\)\s*\{([\s\S]*)/i)?.[1] ?? String(source)
  return !/visual\s*\.\s*setVisible\s*\(\s*false\s*\)/.test(killEnemy)
}
