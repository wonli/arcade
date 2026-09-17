export function previewSummaryKeys(summary = {}) {
  const rows = []
  if (Number.isFinite(Number(summary.score))) rows.push(['home.previewScore', { score: Number(summary.score) }])
  if (Number.isFinite(Number(summary.lines))) rows.push(['home.previewLines', { lines: Number(summary.lines) }])
  if (rows.length < 2 && Number.isFinite(Number(summary.round))) rows.push(['home.previewRound', { round: Number(summary.round) }])
  if (rows.length < 2 && Number.isFinite(Number(summary.moves))) rows.push(['home.previewMoves', { moves: Number(summary.moves) }])
  return rows.slice(0, 2)
}
