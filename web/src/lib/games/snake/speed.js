export const DEFAULT_SNAKE_SPEED = 2
export const SNAKE_SPEED_MIN = 1
export const SNAKE_SPEED_MAX = 5

export function normalizeSnakeSpeed(value) {
  if (value === '' || value === null || value === undefined) return DEFAULT_SNAKE_SPEED
  const level = Number(value)
  return Number.isInteger(level) && level >= SNAKE_SPEED_MIN && level <= SNAKE_SPEED_MAX
    ? level
    : DEFAULT_SNAKE_SPEED
}

export function snakeSpeedLabel(level, locale = 'en') {
  const normalized = normalizeSnakeSpeed(level)
  if (locale === 'zh-CN') {
    return { 1: '初学', 2: '轻松', 3: '标准', 4: '快', 5: '很快' }[normalized]
  }
  return { 1: 'BEGINNER', 2: 'EASY', 3: 'STANDARD', 4: 'FAST', 5: 'VERY FAST' }[normalized]
}
