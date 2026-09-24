package xiangqi

import "github.com/wonli/arcade/game"

var pieceValue = map[int]int{
	Soldier:  100,
	Horse:    300,
	Elephant: 250,
	Chariot:  600,
	Cannon:   350,
	Advisor:  250,
	General:  10000,
}

// ChooseBotMove intentionally keeps v1 search shallow. The server already
// guarantees every candidate is legal; the bot scores each resulting position
// once and returns immediately instead of blocking the room action on a deep
// search tree.
func ChooseBotMove(state State, color Color) (MoveData, bool) {
	if state.Status != game.StatusPlaying || state.Turn != color {
		return MoveData{}, false
	}
	moves := LegalMoves(state, color)
	if len(moves) == 0 {
		return MoveData{}, false
	}

	best := moves[0]
	bestScore := -1 << 30
	for _, move := range moves {
		next := makeMoveUnchecked(state, move)
		score := evaluate(next, color)
		if score > bestScore {
			bestScore = score
			best = move
		}
	}
	return best, true
}

func evaluate(state State, perspective Color) int {
	score := 0
	for y := 0; y < 10; y++ {
		for x := 0; x < 9; x++ {
			piece := state.Board[y][x]
			if piece == Empty {
				continue
			}
			value := pieceValue[abs(piece)]
			if abs(piece) == Soldier {
				if piece > 0 {
					value += (9 - y) * 3
				} else {
					value += y * 3
				}
				centerDistance := x - 4
				if centerDistance < 0 {
					centerDistance = -centerDistance
				}
				value += 4 - centerDistance
			}
			if colorOf(piece) == perspective {
				score += value
			} else {
				score -= value
			}
		}
	}
	return score
}
