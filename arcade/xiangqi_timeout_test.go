package arcade

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/xiangqi"
	"github.com/wonli/arcade/room"
)

func TestXiangqiBlackTimeoutAwardsRed(t *testing.T) {
	s := NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "black", "Black"); err != nil {
		t.Fatal(err)
	}

	state := r.Game().State().(xiangqi.State)
	payload, err := json.Marshal(state.Legal[0])
	if err != nil {
		t.Fatal(err)
	}
	if err := s.MovePlayer(r.ID, "red", payload); err != nil {
		t.Fatal(err)
	}
	state = r.Game().State().(xiangqi.State)
	if state.Turn != xiangqi.Black || state.Ply != 1 {
		t.Fatalf("expected black turn after red move: %#v", state)
	}

	forfeited, err := s.ForfeitXiangqiTurn(r.ID, xiangqi.Black, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !forfeited {
		t.Fatal("expected black turn to time out")
	}

	state = r.Game().State().(xiangqi.State)
	if state.Status != game.StatusFinished || state.Winner != xiangqi.Red || state.DrawReason != "timeout" {
		t.Fatalf("unexpected timeout result: %#v", state)
	}
	if got := r.Snapshot()["status"]; got != room.StatusFinished {
		t.Fatalf("room status = %v, want %v", got, room.StatusFinished)
	}
}

func TestXiangqiStaleTimeoutDoesNotBeatMove(t *testing.T) {
	s := NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "black", "Black"); err != nil {
		t.Fatal(err)
	}

	state := r.Game().State().(xiangqi.State)
	payload, _ := json.Marshal(state.Legal[0])
	if err := s.MovePlayer(r.ID, "red", payload); err != nil {
		t.Fatal(err)
	}

	forfeited, err := s.ForfeitXiangqiTurn(r.ID, xiangqi.Red, 0)
	if err != nil {
		t.Fatal(err)
	}
	if forfeited {
		t.Fatal("stale red timeout ended the black turn")
	}
	state = r.Game().State().(xiangqi.State)
	if state.Status != game.StatusPlaying || state.Turn != xiangqi.Black || state.Ply != 1 {
		t.Fatalf("stale timeout changed game: %#v", state)
	}
}
