package gomoku

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
)

func move(t *testing.T, g *Game, player game.PlayerID, x, y int) {
	t.Helper()
	data, err := json.Marshal(Position{X: x, Y: y})
	if err != nil {
		t.Fatal(err)
	}
	if err := g.Move(game.Move{Player: player, Data: data}); err != nil {
		t.Fatal(err)
	}
}

func TestHorizontalWin(t *testing.T) {
	const black game.PlayerID = "black"
	const white game.PlayerID = "white"
	g := New(black, white)

	for x := 0; x < 4; x++ {
		move(t, g, black, x, 7)
		move(t, g, white, x, 8)
	}
	move(t, g, black, 4, 7)

	state := g.State().(State)
	if state.Winner != Black {
		t.Fatalf("winner = %v, want black", state.Winner)
	}
	if state.Status != game.StatusFinished {
		t.Fatalf("status = %s, want finished", state.Status)
	}
}

func TestRejectsMoveOutOfTurn(t *testing.T) {
	g := New("black", "white")
	data, _ := json.Marshal(Position{X: 7, Y: 7})
	if err := g.Move(game.Move{Player: "white", Data: data}); err == nil {
		t.Fatal("expected out-of-turn move to fail")
	}
}
