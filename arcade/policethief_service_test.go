package arcade

import (
	"testing"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/policethief"
)

func TestPoliceThiefHostRoleControlsPlayerAssignment(t *testing.T) {
	s := NewService()
	r, err := s.Create("policethief", 2)
	if err != nil {
		t.Fatal(err)
	}
	r.SetRuntimeState(policethief.Setup{HostRole: policethief.Police})
	if err := s.Join(r.ID, game.PlayerID("host"), "Host"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, game.PlayerID("guest"), "Guest"); err != nil {
		t.Fatal(err)
	}
	state := r.Game().State().(policethief.State)
	if state.PolicePlayer != "host" || state.ThiefPlayer != "guest" {
		t.Fatalf("role assignment = police:%q thief:%q", state.PolicePlayer, state.ThiefPlayer)
	}
	if state.Turn != policethief.Thief {
		t.Fatalf("thief must still move first, got %q", state.Turn)
	}
}

func TestPoliceThiefBotCanTakeThiefAndMoveFirst(t *testing.T) {
	s := NewService()
	r, err := s.Create("policethief", 2)
	if err != nil {
		t.Fatal(err)
	}
	r.SetRuntimeState(policethief.Setup{HostRole: policethief.Police})
	if err := s.Join(r.ID, "host", "Host"); err != nil {
		t.Fatal(err)
	}
	if err := s.AddBot(r.ID, "host"); err != nil {
		t.Fatal(err)
	}
	state := r.Game().State().(policethief.State)
	if state.ThiefPlayer != r.Players[1].ID || !r.Players[1].Bot {
		t.Fatalf("bot should own thief role: players=%#v state=%#v", r.Players, state)
	}
	if state.Moves != 1 || state.Turn != policethief.Police {
		t.Fatalf("thief bot should make opening move immediately: moves=%d turn=%q", state.Moves, state.Turn)
	}
}
