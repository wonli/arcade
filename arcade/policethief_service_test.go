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

type chaseStep struct {
	role policethief.Role
	to   policethief.Node
}

type chaseState struct {
	thief  policethief.Node
	police policethief.Node
	turn   policethief.Role
}

func finishPoliceThief(t *testing.T, r interface {
	Game() game.Game
	Move(game.PlayerID, json.RawMessage) error
}) {
	t.Helper()
	state := r.Game().State().(policethief.State)
	steps := shortestCooperativeCapture(state)
	if len(steps) == 0 {
		t.Fatalf("no legal capture path from thief=%s police=%s turn=%s", state.Thief, state.Police, state.Turn)
	}
	for _, step := range steps {
		state = r.Game().State().(policethief.State)
		player := state.ThiefPlayer
		if step.role == policethief.Police {
			player = state.PolicePlayer
		}
		payload, err := json.Marshal(policethief.Move{To: step.to})
		if err != nil {
			t.Fatal(err)
		}
		if err := r.Move(player, payload); err != nil {
			t.Fatalf("finish move %s -> %s failed: %v", step.role, step.to, err)
		}
	}
	if r.Game().Status() != game.StatusFinished {
		t.Fatal("expected police thief game to finish")
	}
}

func shortestCooperativeCapture(state policethief.State) []chaseStep {
	start := chaseState{thief: state.Thief, police: state.Police, turn: state.Turn}
	type pathState struct {
		state chaseState
		path  []chaseStep
	}
	queue := []pathState{{state: start}}
	seen := map[chaseState]bool{start: true}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if current.state.turn == policethief.Thief {
			for _, to := range policethief.Connections(current.state.thief) {
				if to == current.state.police {
					continue
				}
				next := chaseState{thief: to, police: current.state.police, turn: policethief.Police}
				if seen[next] {
					continue
				}
				seen[next] = true
				path := append(append([]chaseStep(nil), current.path...), chaseStep{role: policethief.Thief, to: to})
				queue = append(queue, pathState{state: next, path: path})
			}
			continue
		}

		for _, to := range policethief.Connections(current.state.police) {
			path := append(append([]chaseStep(nil), current.path...), chaseStep{role: policethief.Police, to: to})
			if to == current.state.thief {
				return path
			}
			next := chaseState{thief: current.state.thief, police: to, turn: policethief.Thief}
			if seen[next] {
				continue
			}
			seen[next] = true
			queue = append(queue, pathState{state: next, path: path})
		}
	}
	return nil
}
