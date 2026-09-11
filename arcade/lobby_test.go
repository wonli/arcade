package arcade

import (
	"testing"

	"github.com/wonli/arcade/room"
)

func TestSnakeRoomUsesHostStartedLobby(t *testing.T) {
	s := NewService()
	r, err := s.Create("snake", 1, 8)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	if r.MinPlayers != 1 || r.MaxPlayers != 8 {
		t.Fatalf("bounds = %d/%d, want 1/8", r.MinPlayers, r.MaxPlayers)
	}
	if r.HostID != "p1" {
		t.Fatalf("host = %q, want p1", r.HostID)
	}
	if r.Status != room.StatusWaiting {
		t.Fatalf("status = %q, want waiting", r.Status)
	}
	if r.Started() {
		t.Fatal("snake room must not auto-start after first player joins")
	}
}

func TestRoomRejectsNewPlayersAfterMatchStarts(t *testing.T) {
	s := NewService()
	r, err := s.Create("snake", 1, 8)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	r.SetStatus(room.StatusPlaying)
	if err := s.Join(r.ID, "p2", "Player 2"); err == nil {
		t.Fatal("expected join after start to fail")
	}
}

func TestExistingRoomModesKeepTheirBounds(t *testing.T) {
	s := NewService()
	gomoku, err := s.Create("gomoku", 2, 2)
	if err != nil {
		t.Fatal(err)
	}
	if gomoku.MinPlayers != 2 || gomoku.MaxPlayers != 2 {
		t.Fatalf("gomoku bounds = %d/%d, want 2/2", gomoku.MinPlayers, gomoku.MaxPlayers)
	}
	tetris, err := s.Create("tetris", 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if tetris.MinPlayers != 1 || tetris.MaxPlayers != 1 {
		t.Fatalf("tetris bounds = %d/%d, want 1/1", tetris.MinPlayers, tetris.MaxPlayers)
	}
}
