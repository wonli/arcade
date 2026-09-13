package chess

import (
	"sort"
	"strings"
)

type Difficulty string

const (
	Easy Difficulty = "easy"
	Medium Difficulty = "medium"
	Hard Difficulty = "hard"
	Expert Difficulty = "expert"
)

type searchConfig struct { depth int; maxNodes int }
type searcher struct { root Color; nodes int; maxNodes int }

func NormalizeDifficulty(value string) Difficulty {
	switch Difficulty(strings.ToLower(strings.TrimSpace(value))) {
	case Easy: return Easy
	case Medium: return Medium
	case Hard: return Hard
	case Expert: return Expert
	default: return Medium
	}
}

func configForDifficulty(level Difficulty) searchConfig {
	switch NormalizeDifficulty(string(level)) {
	case Easy: return searchConfig{depth: 1, maxNodes: 300}
	case Hard: return searchConfig{depth: 3, maxNodes: 12000}
	case Expert: return searchConfig{depth: 4, maxNodes: 50000}
	default: return searchConfig{depth: 2, maxNodes: 2500}
	}
}

func ChooseBotMove(state State, color Color, difficulty Difficulty) (MoveData, bool) {
	if color != White && color != Black || state.Turn != color { return MoveData{}, false }
	moves := LegalMoves(state, color)
	if len(moves) == 0 { return MoveData{}, false }
	orderMoves(state, moves)
	cfg := configForDifficulty(difficulty)
	s := &searcher{root: color, maxNodes: cfg.maxNodes}
	best, bestScore := moves[0], -mateScore*2
	alpha, beta := -mateScore*2, mateScore*2
	for _, move := range moves {
		if s.nodes >= s.maxNodes { break }
		next := makeMoveUnchecked(state, move)
		score := -s.negamax(next, cfg.depth-1, -beta, -alpha, opposite(color), 1)
		if score > bestScore { bestScore, best = score, move }
		if score > alpha { alpha = score }
	}
	return best, true
}

const mateScore = 1000000

func (s *searcher) negamax(state State, depth, alpha, beta int, color Color, ply int) int {
	if s.nodes >= s.maxNodes { return evaluate(state, s.root) * colorSign(color, s.root) }
	s.nodes++
	moves := LegalMoves(state, color)
	if len(moves) == 0 {
		if inCheck(state, color) { return -mateScore + ply }
		return 0
	}
	if depth <= 0 { return evaluate(state, s.root) * colorSign(color, s.root) }
	orderMoves(state, moves)
	best := -mateScore * 2
	for _, move := range moves {
		if s.nodes >= s.maxNodes { break }
		next := makeMoveUnchecked(state, move)
		score := -s.negamax(next, depth-1, -beta, -alpha, opposite(color), ply+1)
		if score > best { best = score }
		if score > alpha { alpha = score }
		if alpha >= beta { break }
	}
	if best == -mateScore*2 { return evaluate(state, s.root) * colorSign(color, s.root) }
	return best
}

func colorSign(side, root Color) int { if side == root { return 1 }; return -1 }

func evaluate(state State, root Color) int {
	score := 0
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			piece := state.Board[y][x]
			if piece == Empty { continue }
			value := pieceValue(abs(piece)) + positionalBonus(abs(piece), x, y, colorOf(piece))
			if colorOf(piece) == root { score += value } else { score -= value }
		}
	}
	if inCheck(state, opposite(root)) { score += 35 }
	if inCheck(state, root) { score -= 35 }
	return score
}

func pieceValue(kind int) int {
	switch kind {
	case 1: return 100
	case 2: return 320
	case 3: return 330
	case 4: return 500
	case 5: return 900
	case 6: return 20000
	default: return 0
	}
}

func positionalBonus(kind, x, y int, color Color) int {
	cx, cy := abs(3-x), abs(3-y)
	center := 8 - (cx + cy)
	switch kind {
	case 1:
		advance := 6-y
		if color == Black { advance = y-1 }
		return advance*5 + center
	case 2, 3: return center * 4
	case 4: return center
	case 5: return center * 2
	case 6:
		if y == 0 || y == 7 { return 8 }
		return -center * 2
	}
	return 0
}

func orderMoves(state State, moves []MoveData) {
	sort.SliceStable(moves, func(i, j int) bool { return moveOrderScore(state, moves[i]) > moveOrderScore(state, moves[j]) })
}

func moveOrderScore(state State, move MoveData) int {
	piece := state.Board[move.From.Y][move.From.X]
	target := state.Board[move.To.Y][move.To.X]
	score := 0
	if target != Empty { score += 10*pieceValue(abs(target)) - pieceValue(abs(piece)) }
	if abs(piece) == 1 && (move.To.Y == 0 || move.To.Y == 7) { score += pieceValue(abs(promotedPiece(colorOf(piece), move.Promotion))) }
	if abs(piece) == 6 && abs(move.To.X-move.From.X) == 2 { score += 50 }
	return score
}
