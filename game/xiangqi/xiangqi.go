package xiangqi

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/wonli/arcade/game"
)

type Color string

const (
	Red   Color = "red"
	Black Color = "black"
)

const (
	Empty = 0

	Soldier  = 1
	Horse    = 2
	Elephant = 3
	Chariot  = 4
	Cannon   = 5
	Advisor  = 6
	General  = 7

	RedSoldier  = Soldier
	RedHorse    = Horse
	RedElephant = Elephant
	RedChariot  = Chariot
	RedCannon   = Cannon
	RedAdvisor  = Advisor
	RedGeneral  = General

	BlackSoldier  = -Soldier
	BlackHorse    = -Horse
	BlackElephant = -Elephant
	BlackChariot  = -Chariot
	BlackCannon   = -Cannon
	BlackAdvisor  = -Advisor
	BlackGeneral  = -General
)

type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type MoveData struct {
	From Position `json:"from"`
	To   Position `json:"to"`
}

type State struct {
	Board      [10][9]int  `json:"board"`
	Turn       Color       `json:"turn"`
	Winner     Color       `json:"winner,omitempty"`
	Status     game.Status `json:"status"`
	Last       *MoveData   `json:"last,omitempty"`
	Check      bool        `json:"check"`
	Ply        int         `json:"ply"`
	DrawReason string      `json:"drawReason,omitempty"`
	Legal      []MoveData  `json:"legalMoves,omitempty"`
}

type Game struct {
	state   State
	players map[game.PlayerID]Color
}

func New(red, black game.PlayerID) *Game {
	g := &Game{players: map[game.PlayerID]Color{red: Red, black: Black}}
	g.Reset()
	return g
}

func (g *Game) Name() string        { return "xiangqi" }
func (g *Game) Status() game.Status { return g.state.Status }
func (g *Game) State() any          { return g.state }

func (g *Game) Reset() {
	g.state = initialState()
	g.state.Legal = LegalMoves(g.state, Red)
}

func initialState() State {
	s := emptyState(Red)
	s.Status = game.StatusPlaying
	s.Board[0] = [9]int{BlackChariot, BlackHorse, BlackElephant, BlackAdvisor, BlackGeneral, BlackAdvisor, BlackElephant, BlackHorse, BlackChariot}
	s.Board[2][1], s.Board[2][7] = BlackCannon, BlackCannon
	for _, x := range []int{0, 2, 4, 6, 8} {
		s.Board[3][x] = BlackSoldier
	}
	s.Board[9] = [9]int{RedChariot, RedHorse, RedElephant, RedAdvisor, RedGeneral, RedAdvisor, RedElephant, RedHorse, RedChariot}
	s.Board[7][1], s.Board[7][7] = RedCannon, RedCannon
	for _, x := range []int{0, 2, 4, 6, 8} {
		s.Board[6][x] = RedSoldier
	}
	return s
}

func emptyState(turn Color) State {
	return State{Turn: turn, Status: game.StatusPlaying}
}

func (g *Game) Move(m game.Move) error {
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}
	color, ok := g.players[m.Player]
	if !ok {
		return errors.New("player is not in this game")
	}
	if color != g.state.Turn {
		return errors.New("not your turn")
	}
	var move MoveData
	if err := json.Unmarshal(m.Data, &move); err != nil {
		return fmt.Errorf("invalid move: %w", err)
	}
	if !inBounds(move.From.X, move.From.Y) || !inBounds(move.To.X, move.To.Y) {
		return errors.New("position out of board")
	}
	piece := g.state.Board[move.From.Y][move.From.X]
	if piece == Empty || colorOf(piece) != color {
		return errors.New("invalid source piece")
	}
	if !containsMove(g.state.Legal, move) {
		return errors.New("illegal move")
	}
	g.state = makeMoveUnchecked(g.state, move)
	g.finishIfNeeded()
	return nil
}

func (g *Game) Resign(playerID game.PlayerID) error {
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}
	color, ok := g.players[playerID]
	if !ok {
		return errors.New("player is not in this game")
	}
	g.state.Status = game.StatusFinished
	g.state.Winner = opposite(color)
	g.state.DrawReason = "resignation"
	g.state.Check = false
	g.state.Legal = nil
	return nil
}

func (g *Game) finishIfNeeded() {
	if g.state.Status != game.StatusPlaying {
		return
	}
	if _, ok := generalPosition(g.state, g.state.Turn); !ok {
		g.state.Status = game.StatusFinished
		g.state.Winner = opposite(g.state.Turn)
		g.state.Check = false
		g.state.Legal = nil
		return
	}
	moves := LegalMoves(g.state, g.state.Turn)
	g.state.Check = inCheck(g.state, g.state.Turn)
	g.state.Legal = moves
	if len(moves) == 0 {
		g.state.Status = game.StatusFinished
		g.state.Winner = opposite(g.state.Turn)
		g.state.Legal = nil
	}
}

func LegalMoves(state State, color Color) []MoveData {
	if color != Red && color != Black {
		return nil
	}
	if _, ok := generalPosition(state, color); !ok {
		return nil
	}
	pseudo := pseudoMoves(state, color)
	legal := make([]MoveData, 0, len(pseudo))
	for _, move := range pseudo {
		next := makeMoveUnchecked(state, move)
		if !inCheck(next, color) {
			legal = append(legal, move)
		}
	}
	return legal
}

func pseudoMoves(state State, color Color) []MoveData {
	moves := make([]MoveData, 0, 48)
	for y := 0; y < 10; y++ {
		for x := 0; x < 9; x++ {
			piece := state.Board[y][x]
			if piece == Empty || colorOf(piece) != color {
				continue
			}
			from := Position{X: x, Y: y}
			switch abs(piece) {
			case Soldier:
				moves = append(moves, soldierMoves(state, from, color)...)
			case Horse:
				moves = append(moves, horseMoves(state, from, color)...)
			case Elephant:
				moves = append(moves, elephantMoves(state, from, color)...)
			case Chariot:
				moves = append(moves, chariotMoves(state, from, color)...)
			case Cannon:
				moves = append(moves, cannonMoves(state, from, color)...)
			case Advisor:
				moves = append(moves, advisorMoves(state, from, color)...)
			case General:
				moves = append(moves, generalMoves(state, from, color)...)
			}
		}
	}
	return moves
}

func chariotMoves(state State, from Position, color Color) []MoveData {
	moves := make([]MoveData, 0, 16)
	for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
		for x, y := from.X+d[0], from.Y+d[1]; inBounds(x, y); x, y = x+d[0], y+d[1] {
			piece := state.Board[y][x]
			if piece == Empty {
				moves = append(moves, MoveData{From: from, To: Position{x, y}})
				continue
			}
			if colorOf(piece) != color {
				moves = append(moves, MoveData{From: from, To: Position{x, y}})
			}
			break
		}
	}
	return moves
}

func horseMoves(state State, from Position, color Color) []MoveData {
	type jump struct{ dx, dy, lx, ly int }
	jumps := []jump{
		{1, 2, 0, 1}, {-1, 2, 0, 1}, {1, -2, 0, -1}, {-1, -2, 0, -1},
		{2, 1, 1, 0}, {2, -1, 1, 0}, {-2, 1, -1, 0}, {-2, -1, -1, 0},
	}
	moves := make([]MoveData, 0, 8)
	for _, j := range jumps {
		legX, legY := from.X+j.lx, from.Y+j.ly
		toX, toY := from.X+j.dx, from.Y+j.dy
		if !inBounds(toX, toY) || !inBounds(legX, legY) || state.Board[legY][legX] != Empty {
			continue
		}
		if piece := state.Board[toY][toX]; piece != Empty && colorOf(piece) == color {
			continue
		}
		moves = append(moves, MoveData{From: from, To: Position{toX, toY}})
	}
	return moves
}

func cannonMoves(state State, from Position, color Color) []MoveData {
	moves := make([]MoveData, 0, 16)
	for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
		screenSeen := false
		for x, y := from.X+d[0], from.Y+d[1]; inBounds(x, y); x, y = x+d[0], y+d[1] {
			piece := state.Board[y][x]
			if !screenSeen {
				if piece == Empty {
					moves = append(moves, MoveData{From: from, To: Position{x, y}})
					continue
				}
				screenSeen = true
				continue
			}
			if piece == Empty {
				continue
			}
			if colorOf(piece) != color {
				moves = append(moves, MoveData{From: from, To: Position{x, y}})
			}
			break
		}
	}
	return moves
}

func elephantMoves(state State, from Position, color Color) []MoveData {
	moves := make([]MoveData, 0, 4)
	for _, d := range [][2]int{{2, 2}, {2, -2}, {-2, 2}, {-2, -2}} {
		toX, toY := from.X+d[0], from.Y+d[1]
		if !inBounds(toX, toY) {
			continue
		}
		if color == Red && toY < 5 {
			continue
		}
		if color == Black && toY > 4 {
			continue
		}
		eyeX, eyeY := from.X+d[0]/2, from.Y+d[1]/2
		if state.Board[eyeY][eyeX] != Empty {
			continue
		}
		if piece := state.Board[toY][toX]; piece != Empty && colorOf(piece) == color {
			continue
		}
		moves = append(moves, MoveData{From: from, To: Position{toX, toY}})
	}
	return moves
}

func advisorMoves(state State, from Position, color Color) []MoveData {
	moves := make([]MoveData, 0, 4)
	for _, d := range [][2]int{{1, 1}, {1, -1}, {-1, 1}, {-1, -1}} {
		to := Position{from.X + d[0], from.Y + d[1]}
		if !inPalace(to, color) {
			continue
		}
		if piece := state.Board[to.Y][to.X]; piece != Empty && colorOf(piece) == color {
			continue
		}
		moves = append(moves, MoveData{From: from, To: to})
	}
	return moves
}

func generalMoves(state State, from Position, color Color) []MoveData {
	moves := make([]MoveData, 0, 5)
	for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
		to := Position{from.X + d[0], from.Y + d[1]}
		if !inPalace(to, color) {
			continue
		}
		if piece := state.Board[to.Y][to.X]; piece != Empty && colorOf(piece) == color {
			continue
		}
		moves = append(moves, MoveData{From: from, To: to})
	}
	if enemy, ok := generalPosition(state, opposite(color)); ok && enemy.X == from.X {
		clear := true
		start, end := from.Y, enemy.Y
		if start > end {
			start, end = end, start
		}
		for y := start + 1; y < end; y++ {
			if state.Board[y][from.X] != Empty {
				clear = false
				break
			}
		}
		if clear {
			moves = append(moves, MoveData{From: from, To: enemy})
		}
	}
	return moves
}

func soldierMoves(state State, from Position, color Color) []MoveData {
	moves := make([]MoveData, 0, 3)
	forward := -1
	crossed := from.Y <= 4
	if color == Black {
		forward = 1
		crossed = from.Y >= 5
	}
	candidates := []Position{{from.X, from.Y + forward}}
	if crossed {
		candidates = append(candidates, Position{from.X - 1, from.Y}, Position{from.X + 1, from.Y})
	}
	for _, to := range candidates {
		if !inBounds(to.X, to.Y) {
			continue
		}
		if piece := state.Board[to.Y][to.X]; piece != Empty && colorOf(piece) == color {
			continue
		}
		moves = append(moves, MoveData{From: from, To: to})
	}
	return moves
}

func inCheck(state State, color Color) bool {
	general, ok := generalPosition(state, color)
	if !ok {
		return true
	}
	for _, move := range pseudoMoves(state, opposite(color)) {
		if move.To == general {
			return true
		}
	}
	return false
}

func generalPosition(state State, color Color) (Position, bool) {
	want := RedGeneral
	if color == Black {
		want = BlackGeneral
	}
	for y := 0; y < 10; y++ {
		for x := 0; x < 9; x++ {
			if state.Board[y][x] == want {
				return Position{x, y}, true
			}
		}
	}
	return Position{}, false
}

func makeMoveUnchecked(state State, move MoveData) State {
	piece := state.Board[move.From.Y][move.From.X]
	state.Board[move.From.Y][move.From.X] = Empty
	state.Board[move.To.Y][move.To.X] = piece
	state.Turn = opposite(state.Turn)
	copyMove := move
	state.Last = &copyMove
	state.Ply++
	state.Check = false
	state.Legal = nil
	state.Winner = ""
	state.DrawReason = ""
	return state
}

func containsMove(moves []MoveData, target MoveData) bool {
	for _, move := range moves {
		if move == target {
			return true
		}
	}
	return false
}

func inPalace(pos Position, color Color) bool {
	if pos.X < 3 || pos.X > 5 {
		return false
	}
	if color == Red {
		return pos.Y >= 7 && pos.Y <= 9
	}
	return pos.Y >= 0 && pos.Y <= 2
}

func inBounds(x, y int) bool { return x >= 0 && x < 9 && y >= 0 && y < 10 }

func colorOf(piece int) Color {
	if piece > 0 {
		return Red
	}
	if piece < 0 {
		return Black
	}
	return ""
}

func opposite(color Color) Color {
	if color == Red {
		return Black
	}
	return Red
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}
