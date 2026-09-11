package snake

import (
	"testing"

	"github.com/wonli/arcade/game"
)

func fixedRandom(n int) int { return 0 }

func TestTickMovesSnakeForward(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}}, fixedRandom)
	before := g.state.Snakes[0].Body[0]
	after := g.Tick().Snakes[0].Body[0]
	if after.X != before.X+1 || after.Y != before.Y {
		t.Fatalf("head = %#v, want one cell right from %#v", after, before)
	}
}

func TestInputRejectsImmediateReverse(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}}, fixedRandom)
	if err := g.Input("p1", Left); err == nil {
		t.Fatal("expected reverse direction to fail")
	}
	if err := g.Input("p1", Down); err != nil {
		t.Fatalf("down input failed: %v", err)
	}
}

func TestEatingFoodGrowsSnakeAndScores(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}}, fixedRandom)
	snake := &g.state.Snakes[0]
	head := snake.Body[0]
	g.state.Food = Point{X: head.X + 1, Y: head.Y}
	beforeLen := len(snake.Body)
	state := g.Tick()
	if len(state.Snakes[0].Body) != beforeLen+1 {
		t.Fatalf("length = %d, want %d", len(state.Snakes[0].Body), beforeLen+1)
	}
	if state.Snakes[0].Score != 1 {
		t.Fatalf("score = %d, want 1", state.Snakes[0].Score)
	}
}

func TestWallCollisionFinishesSoloGame(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}}, fixedRandom)
	g.state.Snakes[0].Body = []Point{{X: Width - 1, Y: 5}, {X: Width - 2, Y: 5}, {X: Width - 3, Y: 5}}
	g.state.Snakes[0].Direction = Right
	state := g.Tick()
	if state.Snakes[0].Alive {
		t.Fatal("snake should die on wall collision")
	}
	if state.Status != game.StatusFinished {
		t.Fatalf("status = %q, want finished", state.Status)
	}
}

func TestBodyCollisionKillsSnake(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}, {ID: "p2", Name: "Player 2"}}, fixedRandom)
	g.state.Snakes[0].Body = []Point{{X: 5, Y: 5}, {X: 4, Y: 5}, {X: 3, Y: 5}}
	g.state.Snakes[0].Direction = Right
	g.state.Snakes[1].Body = []Point{{X: 7, Y: 4}, {X: 6, Y: 5}, {X: 6, Y: 6}}
	g.state.Snakes[1].Direction = Up
	state := g.Tick()
	if state.Snakes[0].Alive {
		t.Fatal("p1 should die after moving into p2 body")
	}
}

func TestHeadToHeadKillsBothSnakes(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}, {ID: "p2", Name: "Player 2"}}, fixedRandom)
	g.state.Snakes[0].Body = []Point{{X: 5, Y: 5}, {X: 4, Y: 5}, {X: 3, Y: 5}}
	g.state.Snakes[0].Direction = Right
	g.state.Snakes[1].Body = []Point{{X: 7, Y: 5}, {X: 8, Y: 5}, {X: 9, Y: 5}}
	g.state.Snakes[1].Direction = Left
	state := g.Tick()
	if state.Snakes[0].Alive || state.Snakes[1].Alive {
		t.Fatal("both snakes should die in head-to-head collision")
	}
	if state.Status != game.StatusFinished {
		t.Fatalf("status = %q, want finished", state.Status)
	}
}

func TestLastAlivePlayerWins(t *testing.T) {
	g := New([]Player{{ID: "p1", Name: "Player 1"}, {ID: "p2", Name: "Player 2"}}, fixedRandom)
	g.state.Snakes[0].Body = []Point{{X: Width - 1, Y: 5}, {X: Width - 2, Y: 5}, {X: Width - 3, Y: 5}}
	g.state.Snakes[0].Direction = Right
	g.state.Snakes[1].Body = []Point{{X: 10, Y: 10}, {X: 9, Y: 10}, {X: 8, Y: 10}}
	g.state.Snakes[1].Direction = Right
	state := g.Tick()
	if state.Status != game.StatusFinished {
		t.Fatalf("status = %q, want finished", state.Status)
	}
	if state.Winner != "p2" {
		t.Fatalf("winner = %q, want p2", state.Winner)
	}
}
