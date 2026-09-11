package arcade

import (
	"testing"
	"time"

	"github.com/wonli/arcade/game/snake"
	"github.com/wonli/arcade/room"
)

func TestSnakeStartRequiresHostAndSupportsSolo(t *testing.T) {
	s := NewService()
	s.snakeTick = time.Millisecond
	r, err := s.Create("snake", 1, 8)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil { t.Fatal(err) }

	if err := s.StartSnake(r.ID, "other", nil); err == nil {
		t.Fatal("expected non-host start to fail")
	}

	states := make(chan snake.State, 8)
	if err := s.StartSnake(r.ID, "p1", func(_ string, state snake.State) { states <- state }); err != nil {
		t.Fatal(err)
	}
	if r.Status != room.StatusPlaying {
		t.Fatalf("status = %q, want playing", r.Status)
	}
	select {
	case state := <-states:
		if state.Tick < 1 { t.Fatalf("tick = %d, want >= 1", state.Tick) }
	case <-time.After(200 * time.Millisecond):
		t.Fatal("snake runtime did not publish a tick")
	}
}

func TestSnakeInputRequiresRoomPlayer(t *testing.T) {
	s := NewService()
	s.snakeTick = time.Hour
	r, _ := s.Create("snake", 1, 8)
	_ = s.Join(r.ID, "p1", "Player 1")
	if err := s.StartSnake(r.ID, "p1", nil); err != nil { t.Fatal(err) }
	if err := s.SnakeInput(r.ID, "other", snake.Down); err == nil {
		t.Fatal("expected outsider input to fail")
	}
	if err := s.SnakeInput(r.ID, "p1", snake.Down); err != nil {
		t.Fatalf("valid input failed: %v", err)
	}
}

func TestSnakeRestartRequiresHostAndFinishedRoom(t *testing.T) {
	s := NewService()
	s.snakeTick = time.Hour
	r, _ := s.Create("snake", 1, 8)
	_ = s.Join(r.ID, "p1", "Player 1")
	r.SetStatus(room.StatusFinished)

	if err := s.RestartSnake(r.ID, "other", nil); err == nil {
		t.Fatal("expected non-host restart to fail")
	}
	if err := s.RestartSnake(r.ID, "p1", nil); err != nil {
		t.Fatal(err)
	}
	if r.Status != room.StatusPlaying {
		t.Fatalf("status = %q, want playing", r.Status)
	}
}
