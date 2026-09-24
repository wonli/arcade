package arcade

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/wonli/arcade/game/xiangqi"
)

func TestXiangqiRoomStartsWithTwoPlayers(t *testing.T) {
	s := NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if r.Game() != nil {
		t.Fatal("game started before second player")
	}
	if err := s.Join(r.ID, "black", "Black"); err != nil {
		t.Fatal(err)
	}
	state, ok := r.Game().State().(xiangqi.State)
	if !ok || state.Turn != xiangqi.Red {
		t.Fatalf("unexpected state: %#v", r.Game().State())
	}
}

func TestXiangqiBotOccupiesBlackSeat(t *testing.T) {
	s := NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if err := s.AddBot(r.ID, "red"); err != nil {
		t.Fatal(err)
	}
	if len(r.Players) != 2 || !r.Players[1].Bot {
		t.Fatalf("bot seat missing: %#v", r.Players)
	}
	state := r.Game().State().(xiangqi.State)
	if state.Turn != xiangqi.Red || state.Ply != 0 {
		t.Fatalf("bot should wait for red: %#v", state)
	}
}

func TestXiangqiPlayerMoveCommitsBeforeBotReply(t *testing.T) {
	s := NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if err := s.AddBot(r.ID, "red"); err != nil {
		t.Fatal(err)
	}

	state := r.Game().State().(xiangqi.State)
	payload, _ := json.Marshal(state.Legal[0])
	if err := s.MovePlayer(r.ID, "red", payload); err != nil {
		t.Fatal(err)
	}
	state = r.Game().State().(xiangqi.State)
	if state.Ply != 1 || state.Turn != xiangqi.Black {
		t.Fatalf("player move should commit before bot reply: %#v", state)
	}

	moved, err := s.RunBot(r.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !moved {
		t.Fatal("expected bot reply")
	}
	state = r.Game().State().(xiangqi.State)
	if state.Ply != 2 || state.Turn != xiangqi.Red {
		t.Fatalf("expected bot reply after committed player move: %#v", state)
	}
}

func TestXiangqiBotRepliesAfterHumanMove(t *testing.T) {
	s := NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if err := s.AddBot(r.ID, "red"); err != nil {
		t.Fatal(err)
	}
	state := r.Game().State().(xiangqi.State)
	move := state.Legal[0]
	payload, _ := json.Marshal(move)
	start := time.Now()
	if err := s.Move(r.ID, "red", payload); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("human move plus bot reply took too long: %s", elapsed)
	}
	state = r.Game().State().(xiangqi.State)
	if state.Ply != 2 || state.Turn != xiangqi.Red {
		t.Fatalf("expected one bot reply: %#v", state)
	}
}

func TestXiangqiResignAwardsOpponent(t *testing.T) {
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
	if err := s.Resign(r.ID, "red"); err != nil {
		t.Fatal(err)
	}
	state := r.Game().State().(xiangqi.State)
	if state.Winner != xiangqi.Black || state.DrawReason != "resignation" {
		t.Fatalf("unexpected result: %#v", state)
	}
}
