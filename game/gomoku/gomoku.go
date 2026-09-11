package gomoku

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/wonli/arcade/game"
)

const Size = 15

type Stone uint8

const (
	Empty Stone = iota
	Black
	White
)

type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type State struct {
	Board   [Size][Size]Stone `json:"board"`
	Turn    Stone             `json:"turn"`
	Winner  Stone             `json:"winner"`
	Status  game.Status       `json:"status"`
	Moves   int               `json:"moves"`
	Last    *Position         `json:"last,omitempty"`
}

type Game struct {
	state   State
	players map[game.PlayerID]Stone
}

func New(black, white game.PlayerID) *Game {
	g := &Game{
		players: map[game.PlayerID]Stone{
			black: Black,
			white: White,
		},
	}
	g.Reset()
	return g
}

func (g *Game) Name() string { return "gomoku" }
func (g *Game) Status() game.Status { return g.state.Status }
func (g *Game) State() any { return g.state }

func (g *Game) Reset() {
	g.state = State{
		Turn:   Black,
		Status: game.StatusPlaying,
	}
}

func (g *Game) Move(m game.Move) error {
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}

	stone, ok := g.players[m.Player]
	if !ok {
		return errors.New("player is not in this game")
	}
	if stone != g.state.Turn {
		return errors.New("not your turn")
	}

	var pos Position
	if err := json.Unmarshal(m.Data, &pos); err != nil {
		return fmt.Errorf("invalid move: %w", err)
	}
	if pos.X < 0 || pos.X >= Size || pos.Y < 0 || pos.Y >= Size {
		return errors.New("position out of board")
	}
	if g.state.Board[pos.Y][pos.X] != Empty {
		return errors.New("position is occupied")
	}

	g.state.Board[pos.Y][pos.X] = stone
	g.state.Moves++
	g.state.Last = &Position{X: pos.X, Y: pos.Y}

	if g.hasFive(pos.X, pos.Y, stone) {
		g.state.Winner = stone
		g.state.Status = game.StatusFinished
		return nil
	}
	if g.state.Moves == Size*Size {
		g.state.Status = game.StatusFinished
		return nil
	}

	if stone == Black {
		g.state.Turn = White
	} else {
		g.state.Turn = Black
	}
	return nil
}

func (g *Game) hasFive(x, y int, stone Stone) bool {
	directions := [][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}}
	for _, d := range directions {
		count := 1 + g.count(x, y, d[0], d[1], stone) + g.count(x, y, -d[0], -d[1], stone)
		if count >= 5 {
			return true
		}
	}
	return false
}

func (g *Game) count(x, y, dx, dy int, stone Stone) int {
	count := 0
	for x, y = x+dx, y+dy; x >= 0 && x < Size && y >= 0 && y < Size; x, y = x+dx, y+dy {
		if g.state.Board[y][x] != stone {
			break
		}
		count++
	}
	return count
}
