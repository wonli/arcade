package arcade

import (
	"encoding/json"
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

func TestPoliceThiefRematchLetsThiefBotOpenAgain(t *testing.T) {
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

	finishPoliceThief(t, r)
	if err := s.Rematch(r.ID, "host"); err != nil {
		t.Fatal(err)
	}
	state := r.Game().State().(policethief.State)
	if state.Moves != 1 || state.Turn != policethief.Police {
		t.Fatalf("thief bot should open rematch immediately: moves=%d turn=%q", state.Moves, state.Turn)
	}
}

func finishPoliceThief(t *testing.T, r interface {
	Game() game.Game
	Move(game.PlayerID, json.RawMessage) error
}) {
	t.Helper()
	for steps := 0; steps < 4; steps++ {
		state := r.Game().State().(policethief.State)
		if state.Status == game.StatusFinished {
			return
		}
		role := state.Turn
		from, target, player := state.Thief, state.Police, state.ThiefPlayer
		if role == policethief.Police {
			from, target, player = state.Police, state.Thief, state.PolicePlayer
		}
		to := nodeToward(from, target)
		payload, err := json.Marshal(policethief.Move{To: to})
		if err != nil {
			t.Fatal(err)
		}
		if err := r.Move(player, payload); err != nil {
			t.Fatalf("finish move %s -> %s failed: %v", from, to, err)
		}
	}
	t.Fatal("expected police thief game to finish")
}

func nodeToward(from, target policethief.Node) policethief.Node {
	for _, next := range policethief.Connections(from) {
		if next == target || policethief.Connected(next, target) {
			return next
		}
	}
	return policethief.Connections(from)[0]
}
