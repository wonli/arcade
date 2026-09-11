package gomoku

func ChooseBotMove(state State, stone Stone) (Position, bool) {
	if stone != Black && stone != White {
		return Position{}, false
	}
	opponent := Black
	if stone == Black {
		opponent = White
	}

	if pos, ok := findTacticalMove(state, stone, 5); ok {
		return pos, true
	}
	if pos, ok := findTacticalMove(state, opponent, 5); ok {
		return pos, true
	}

	bestScore := -1 << 30
	best := Position{}
	found := false
	center := Size / 2
	for y := 0; y < Size; y++ {
		for x := 0; x < Size; x++ {
			if state.Board[y][x] != Empty {
				continue
			}
			score := scoreMove(state, x, y, stone, opponent)
			dx, dy := x-center, y-center
			score -= dx*dx + dy*dy
			if !found || score > bestScore {
				bestScore = score
				best = Position{X: x, Y: y}
				found = true
			}
		}
	}
	return best, found
}

func findTacticalMove(state State, stone Stone, target int) (Position, bool) {
	for y := 0; y < Size; y++ {
		for x := 0; x < Size; x++ {
			if state.Board[y][x] != Empty {
				continue
			}
			board := state.Board
			board[y][x] = stone
			if longestLine(board, x, y, stone) >= target {
				return Position{X: x, Y: y}, true
			}
		}
	}
	return Position{}, false
}

func scoreMove(state State, x, y int, stone, opponent Stone) int {
	score := 0
	for _, d := range [][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}} {
		own, ownOpen := lineShape(state.Board, x, y, d[0], d[1], stone)
		block, blockOpen := lineShape(state.Board, x, y, d[0], d[1], opponent)
		score += shapeScore(own, ownOpen)
		score += shapeScore(block, blockOpen) * 9 / 10
	}
	for dy := -1; dy <= 1; dy++ {
		for dx := -1; dx <= 1; dx++ {
			if dx == 0 && dy == 0 {
				continue
			}
			nx, ny := x+dx, y+dy
			if nx >= 0 && nx < Size && ny >= 0 && ny < Size && state.Board[ny][nx] != Empty {
				score += 40
			}
		}
	}
	return score
}

func shapeScore(count, open int) int {
	switch {
	case count >= 4:
		return 100000
	case count == 3 && open == 2:
		return 12000
	case count == 3:
		return 4500
	case count == 2 && open == 2:
		return 1800
	case count == 2:
		return 600
	case count == 1 && open == 2:
		return 180
	default:
		return count * 30
	}
}

func lineShape(board [Size][Size]Stone, x, y, dx, dy int, stone Stone) (int, int) {
	count := 0
	open := 0
	for _, sign := range []int{-1, 1} {
		nx, ny := x+dx*sign, y+dy*sign
		for nx >= 0 && nx < Size && ny >= 0 && ny < Size && board[ny][nx] == stone {
			count++
			nx += dx * sign
			ny += dy * sign
		}
		if nx >= 0 && nx < Size && ny >= 0 && ny < Size && board[ny][nx] == Empty {
			open++
		}
	}
	return count, open
}

func longestLine(board [Size][Size]Stone, x, y int, stone Stone) int {
	best := 1
	for _, d := range [][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}} {
		count := 1 + countBoard(board, x, y, d[0], d[1], stone) + countBoard(board, x, y, -d[0], -d[1], stone)
		if count > best {
			best = count
		}
	}
	return best
}

func countBoard(board [Size][Size]Stone, x, y, dx, dy int, stone Stone) int {
	count := 0
	for x, y = x+dx, y+dy; x >= 0 && x < Size && y >= 0 && y < Size; x, y = x+dx, y+dy {
		if board[y][x] != stone {
			break
		}
		count++
	}
	return count
}
