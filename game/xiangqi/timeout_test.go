package xiangqi

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
)

func TestForfeitTurnAwardsOpponent(t *testing.T) {
	g := New("red", "black")
	if !g.ForfeitTurn(Red, 0) {
		t.Fatal("expected red turn to be forfeited")
	}

	state := g.State().(State)
	if state.Status != game.StatusFinished || state.Winner != Black || state.DrawReason != "timeout" {
		t.Fatalf("unexpected timeout result: %#v", state)
	}
}

func TestStaleForfeitDoesNotEndAdvancedTurn(t *testing.T) {
	g := New("red", "black")
	state := g.State().(State)
	payload, err := json.Marshal(state.Legal[0])
	if err != nil {
		t.Fatal(err)
	}
	if err := g.Move(game.Move{Player: "red", Data: payload}); err != nil {
		t.Fatal(err)
	}

	if g.ForfeitTurn(Red, 0) {
		t.Fatal("stale red timer forfeited an already advanced turn")
	}
	state = g.State().(State)
	if state.Status != game.StatusPlaying || state.Turn != Black || state.Ply != 1 {
		t.Fatalf("stale timer changed state: %#v", state)
	}
}
