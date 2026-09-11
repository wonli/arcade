package snake

import (
	"errors"
	"sync"

	"github.com/wonli/arcade/game"
)

const (
	Width  = 30
	Height = 20
)

type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type Direction string

const (
	Up    Direction = "up"
	Down  Direction = "down"
	Left  Direction = "left"
	Right Direction = "right"
)

type Player struct {
	ID   game.PlayerID
	Name string
}

type Snake struct {
	PlayerID  game.PlayerID `json:"playerId"`
	Name      string        `json:"name"`
	Body      []Point       `json:"body"`
	Direction Direction     `json:"direction"`
	Alive     bool          `json:"alive"`
	Score     int           `json:"score"`
}

type State struct {
	Width  int           `json:"width"`
	Height int           `json:"height"`
	Tick   int64         `json:"tick"`
	Food   Point         `json:"food"`
	Snakes []Snake       `json:"snakes"`
	Status game.Status   `json:"status"`
	Winner game.PlayerID `json:"winner,omitempty"`
}

type Game struct {
	mu      sync.Mutex
	state   State
	pending map[game.PlayerID]Direction
	random  func(int) int
	players int
}

type spawn struct {
	head Point
	dir  Direction
}

var spawns = []spawn{
	{Point{5, 5}, Right},
	{Point{24, 14}, Left},
	{Point{5, 14}, Right},
	{Point{24, 5}, Left},
	{Point{15, 3}, Down},
	{Point{15, 16}, Up},
	{Point{3, 10}, Right},
	{Point{26, 10}, Left},
}

func New(players []Player, random func(int) int) *Game {
	if random == nil {
		random = func(n int) int { return 0 }
	}
	g := &Game{
		pending: make(map[game.PlayerID]Direction),
		random:  random,
		players: len(players),
		state: State{
			Width:  Width,
			Height: Height,
			Status: game.StatusPlaying,
			Snakes: make([]Snake, 0, len(players)),
		},
	}
	for i, player := range players {
		s := spawns[i%len(spawns)]
		g.state.Snakes = append(g.state.Snakes, Snake{
			PlayerID:  player.ID,
			Name:      player.Name,
			Body:      initialBody(s),
			Direction: s.dir,
			Alive:     true,
		})
	}
	g.state.Food = g.spawnFood()
	return g
}

func initialBody(s spawn) []Point {
	dx, dy := delta(s.dir)
	return []Point{
		s.head,
		{X: s.head.X - dx, Y: s.head.Y - dy},
		{X: s.head.X - 2*dx, Y: s.head.Y - 2*dy},
	}
}

func (g *Game) Input(playerID game.PlayerID, direction Direction) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}
	if !validDirection(direction) {
		return errors.New("invalid direction")
	}
	for _, snake := range g.state.Snakes {
		if snake.PlayerID != playerID {
			continue
		}
		if !snake.Alive {
			return errors.New("snake is dead")
		}
		if opposite(snake.Direction, direction) {
			return errors.New("cannot reverse direction")
		}
		g.pending[playerID] = direction
		return nil
	}
	return errors.New("player is not in game")
}

func (g *Game) Tick() State {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.state.Status != game.StatusPlaying {
		return cloneState(g.state)
	}

	for i := range g.state.Snakes {
		if direction, ok := g.pending[g.state.Snakes[i].PlayerID]; ok {
			g.state.Snakes[i].Direction = direction
		}
	}
	clear(g.pending)

	nextHeads := make([]Point, len(g.state.Snakes))
	eating := make([]bool, len(g.state.Snakes))
	dead := make([]bool, len(g.state.Snakes))
	for i, snake := range g.state.Snakes {
		if !snake.Alive {
			dead[i] = true
			continue
		}
		dx, dy := delta(snake.Direction)
		nextHeads[i] = Point{X: snake.Body[0].X + dx, Y: snake.Body[0].Y + dy}
		eating[i] = nextHeads[i] == g.state.Food
		if nextHeads[i].X < 0 || nextHeads[i].X >= Width || nextHeads[i].Y < 0 || nextHeads[i].Y >= Height {
			dead[i] = true
		}
	}

	for i := range g.state.Snakes {
		if dead[i] { continue }
		for j := i + 1; j < len(g.state.Snakes); j++ {
			if dead[j] { continue }
			if nextHeads[i] == nextHeads[j] {
				dead[i], dead[j] = true, true
			}
		}
	}

	occupied := make(map[Point]struct{})
	for i, snake := range g.state.Snakes {
		if !snake.Alive { continue }
		limit := len(snake.Body)
		if !eating[i] && limit > 0 { limit-- }
		for _, point := range snake.Body[:limit] {
			occupied[point] = struct{}{}
		}
	}
	for i := range g.state.Snakes {
		if dead[i] { continue }
		if _, hit := occupied[nextHeads[i]]; hit {
			dead[i] = true
		}
	}

	ate := false
	for i := range g.state.Snakes {
		snake := &g.state.Snakes[i]
		if !snake.Alive { continue }
		if dead[i] {
			snake.Alive = false
			continue
		}
		body := make([]Point, 0, len(snake.Body)+1)
		body = append(body, nextHeads[i])
		body = append(body, snake.Body...)
		if eating[i] {
			snake.Score++
			ate = true
		} else {
			body = body[:len(body)-1]
		}
		snake.Body = body
	}
	if ate {
		g.state.Food = g.spawnFood()
	}
	g.state.Tick++
	g.finishIfNeeded()
	return cloneState(g.state)
}

func (g *Game) State() State {
	g.mu.Lock()
	defer g.mu.Unlock()
	return cloneState(g.state)
}

func (g *Game) Finished() bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.state.Status == game.StatusFinished
}

func (g *Game) finishIfNeeded() {
	alive := 0
	var winner game.PlayerID
	for _, snake := range g.state.Snakes {
		if snake.Alive {
			alive++
			winner = snake.PlayerID
		}
	}
	if g.players == 1 {
		if alive == 0 {
			g.state.Status = game.StatusFinished
		}
		return
	}
	if g.players > 1 && alive <= 1 {
		g.state.Status = game.StatusFinished
		if alive == 1 {
			g.state.Winner = winner
		}
	}
}

func (g *Game) spawnFood() Point {
	occupied := make(map[Point]struct{})
	for _, snake := range g.state.Snakes {
		for _, point := range snake.Body {
			occupied[point] = struct{}{}
		}
	}
	empty := make([]Point, 0, Width*Height-len(occupied))
	for y := 0; y < Height; y++ {
		for x := 0; x < Width; x++ {
			point := Point{X: x, Y: y}
			if _, used := occupied[point]; !used {
				empty = append(empty, point)
			}
		}
	}
	if len(empty) == 0 { return Point{} }
	index := g.random(len(empty))
	if index < 0 { index = -index }
	return empty[index%len(empty)]
}

func cloneState(state State) State {
	copyState := state
	copyState.Snakes = make([]Snake, len(state.Snakes))
	for i, snake := range state.Snakes {
		copyState.Snakes[i] = snake
		copyState.Snakes[i].Body = append([]Point(nil), snake.Body...)
	}
	return copyState
}

func validDirection(direction Direction) bool {
	return direction == Up || direction == Down || direction == Left || direction == Right
}

func opposite(a, b Direction) bool {
	return (a == Up && b == Down) || (a == Down && b == Up) || (a == Left && b == Right) || (a == Right && b == Left)
}

func delta(direction Direction) (int, int) {
	switch direction {
	case Up: return 0, -1
	case Down: return 0, 1
	case Left: return -1, 0
	default: return 1, 0
	}
}
