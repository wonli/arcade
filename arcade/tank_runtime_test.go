package arcade

import (
	"testing"
	"time"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/tank"
	"github.com/wonli/arcade/room"
)

func TestStartTankRequiresFullRoomAndHost(t *testing.T) {
	s := NewService()
	r, err := s.Create("tank", 2, 2)
	if err != nil { t.Fatal(err) }
	host := game.PlayerID("host")
	guest := game.PlayerID("guest")
	if err := s.Join(r.ID, host, "Host"); err != nil { t.Fatal(err) }
	if err := s.StartTank(r.ID, host, nil); err == nil {
		t.Fatal("expected start with one player to fail")
	}
	if err := s.Join(r.ID, guest, "Guest"); err != nil { t.Fatal(err) }
	if err := s.StartTank(r.ID, guest, nil); err == nil {
		t.Fatal("expected non-host start to fail")
	}
	if err := s.StartTank(r.ID, host, nil); err != nil { t.Fatal(err) }
	if r.Status != room.StatusPlaying {
		t.Fatalf("room status = %q, want playing", r.Status)
	}
}

func TestTankInputPublishesAuthoritativeState(t *testing.T) {
	s := NewService()
	r, err := s.Create("tank", 2, 2)
	if err != nil { t.Fatal(err) }
	host := game.PlayerID("host")
	guest := game.PlayerID("guest")
	if err := s.Join(r.ID, host, "Host"); err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, guest, "Guest"); err != nil { t.Fatal(err) }

	published := make(chan tank.State, 4)
	if err := s.StartTank(r.ID, host, func(_ string, state tank.State) { published <- state }); err != nil { t.Fatal(err) }
	if err := s.TankInput(r.ID, host, tank.Input{Throttle: 1, TurretAngle: 0}); err != nil { t.Fatal(err) }
	if err := s.TankInput(r.ID, game.PlayerID("missing"), tank.Input{}); err == nil {
		t.Fatal("expected non-member input to fail")
	}

	select {
	case state := <-published:
		if state.Tick == 0 { t.Fatal("published state should advance the server tick") }
		if state.Tanks[0].X <= 120 { t.Fatalf("host tank x = %f, want movement", state.Tanks[0].X) }
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for tank state publication")
	}

	s.stopTankRuntime(r.ID)
}
