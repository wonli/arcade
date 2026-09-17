package arcade

import (
	"testing"
	"time"

	"github.com/wonli/arcade/game/snake"
	"github.com/wonli/arcade/room"
)

func TestSnakeSpeedTickDuration(t *testing.T) {
	cases := map[int]time.Duration{
		1: 200 * time.Millisecond,
		2: 160 * time.Millisecond,
		3: 130 * time.Millisecond,
		4: 100 * time.Millisecond,
		5: 80 * time.Millisecond,
	}
	for level, want := range cases {
		got, err := snakeTickForSpeed(level)
		if err != nil {
			t.Fatalf("speed %d returned error: %v", level, err)
		}
		if got != want {
			t.Fatalf("speed %d tick = %s, want %s", level, got, want)
		}
	}
	for _, level := range []int{-1, 0, 6} {
		if _, err := snakeTickForSpeed(level); err == nil {
			t.Fatalf("speed %d should be rejected", level)
		}
	}
}

func TestSnakeStartRequiresHostAndSupportsSolo(t *testing.T) {
	s := NewService()
	r, err := s.Create("snake", 1, 8)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil { t.Fatal(err) }

	if err := s.StartSnake(r.ID, "other", 5, nil); err == nil {
		t.Fatal("expected non-host start to fail")
	}

	states := make(chan snake.State, 8)
	if err := s.StartSnake(r.ID, "p1", 5, func(_ string, state snake.State) { states <- state }); err != nil {
		t.Fatal(err)
	}
	if r.Status != room.StatusPlaying {
		t.Fatalf("status = %q, want playing", r.Status)
	}
	select {
	case state := <-states:
		if state.Tick < 1 { t.Fatalf("tick = %d, want >= 1", state.Tick) }
	case <-time.After(250 * time.Millisecond):
		t.Fatal("snake runtime did not publish a tick")
	}
}

func TestSnakeStartRejectsInvalidSpeed(t *testing.T) {
	s := NewService()
	r, _ := s.Create("snake", 1, 8)
	_ = s.Join(r.ID, "p1", "Player 1")
	if err := s.StartSnake(r.ID, "p1", 6, nil); err == nil {
		t.Fatal("expected invalid snake speed to fail")
	}
}

func TestSnakeStateRestoresRunningGameAfterReconnect(t *testing.T) {
	s := NewService()
	r, _ := s.Create("snake", 1, 8)
	_ = s.Join(r.ID, "p1", "Player 1")
	if err := s.StartSnake(r.ID, "p1", 1, nil); err != nil { t.Fatal(err) }
	if err := s.SnakeInput(r.ID, "p1", snake.Down); err != nil { t.Fatal(err) }

	state, err := s.SnakeState(r.ID, "p1")
	if err != nil { t.Fatal(err) }
	if state.Status != "playing" { t.Fatalf("status = %q, want playing", state.Status) }
	if len(state.Snakes) != 1 || state.Snakes[0].PlayerID != "p1" { t.Fatalf("snakes = %#v", state.Snakes) }
}

func TestSnakeInputRequiresRoomPlayer(t *testing.T) {
	s := NewService()
	r, _ := s.Create("snake", 1, 8)
	_ = s.Join(r.ID, "p1", "Player 1")
	if err := s.StartSnake(r.ID, "p1", 1, nil); err != nil { t.Fatal(err) }
	if err := s.SnakeInput(r.ID, "other", snake.Down); err == nil {
		t.Fatal("expected outsider input to fail")
	}
	if err := s.SnakeInput(r.ID, "p1", snake.Down); err != nil {
		t.Fatalf("valid input failed: %v", err)
	}
}

func TestSnakeRestartRequiresHostAndFinishedRoom(t *testing.T) {
	s := NewService()
	r, _ := s.Create("snake", 1, 8)
	_ = s.Join(r.ID, "p1", "Player 1")
	if err := s.StartSnake(r.ID, "p1", 4, nil); err != nil { t.Fatal(err) }
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

	s.snakeMu.Lock()
	runtime := s.snakes[r.ID]
	s.snakeMu.Unlock()
	if runtime == nil {
		t.Fatal("expected restarted snake runtime")
	}
	if runtime.speed != 4 {
		t.Fatalf("restart speed = %d, want 4", runtime.speed)
	}
}
