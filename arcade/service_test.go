package arcade

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/gomoku"
)

func TestJoinSecondPlayerStartsGomoku(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}

	if err := s.Join(r.ID, game.PlayerID("p1"), "Player 1"); err != nil {
		t.Fatal(err)
	}
	if r.Game() != nil {
		t.Fatal("game started before second player joined")
	}

	if err := s.Join(r.ID, game.PlayerID("p2"), "Player 2"); err != nil {
		t.Fatal(err)
	}
	if r.Game() == nil {
		t.Fatal("game did not start after second player joined")
	}
	if r.Game().Name() != "gomoku" {
		t.Fatalf("game = %q, want gomoku", r.Game().Name())
	}
}

func TestMoveUpdatesAuthoritativeState(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil {
		t.Fatal(err)
	}

	payload, _ := json.Marshal(gomoku.Position{X: 7, Y: 7})
	if err := s.Move(r.ID, "p1", payload); err != nil {
		t.Fatal(err)
	}

	state := r.Game().State().(gomoku.State)
	if state.Board[7][7] != gomoku.Black {
		t.Fatalf("board[7][7] = %v, want black", state.Board[7][7])
	}
	if state.Turn != gomoku.White {
		t.Fatalf("turn = %v, want white", state.Turn)
	}
}

func TestMoveRejectsPlayerOutsideRoom(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}
	_ = s.Join(r.ID, "p1", "Player 1")
	_ = s.Join(r.ID, "p2", "Player 2")

	payload, _ := json.Marshal(gomoku.Position{X: 7, Y: 7})
	if err := s.Move(r.ID, "intruder", payload); err == nil {
		t.Fatal("expected outsider move to fail")
	}
}
