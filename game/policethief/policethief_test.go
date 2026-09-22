package policethief

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
)

func movePayload(to Node) json.RawMessage {
	data, _ := json.Marshal(Move{To: to})
	return data
}

func TestGameStartsWithDistinctValidNodesAndThiefTurn(t *testing.T) {
	g := New("thief-player", "police-player")
	state := g.State().(State)
	if !ValidNode(state.Thief) || !ValidNode(state.Police) {
		t.Fatalf("invalid spawn: thief=%q police=%q", state.Thief, state.Police)
	}
	if state.Thief == state.Police {
		t.Fatalf("spawn nodes must differ: %q", state.Thief)
	}
	if state.Turn != Thief {
		t.Fatalf("thief must move first, got %q", state.Turn)
	}
}

func TestMoveRequiresAnActualDrawnConnection(t *testing.T) {
	g := newGame("thief-player", "police-player", func() (Node, Node) { return B, F })

	if err := g.Move(game.Move{Player: "thief-player", Data: movePayload(C)}); err == nil {
		t.Fatal("B -> C must be rejected because there is no drawn edge")
	}
	if err := g.Move(game.Move{Player: "thief-player", Data: movePayload(B)}); err == nil {
		t.Fatal("staying on the same node must be rejected")
	}
	if err := g.Move(game.Move{Player: "thief-player", Data: movePayload(E)}); err != nil {
		t.Fatalf("B -> E should be legal: %v", err)
	}
}

func TestTurnOrderAndPoliceCapture(t *testing.T) {
	g := newGame("thief-player", "police-player", func() (Node, Node) { return C, B })

	if err := g.Move(game.Move{Player: "police-player", Data: movePayload(A)}); err == nil {
		t.Fatal("police must not move before thief")
	}
	if err := g.Move(game.Move{Player: "thief-player", Data: movePayload(F)}); err != nil {
		t.Fatalf("thief move failed: %v", err)
	}
	if err := g.Move(game.Move{Player: "police-player", Data: movePayload(E)}); err != nil {
		t.Fatalf("police move failed: %v", err)
	}
	if err := g.Move(game.Move{Player: "thief-player", Data: movePayload(E)}); err != nil {
		t.Fatalf("thief should be allowed to move onto police and be caught: %v", err)
	}
	state := g.State().(State)
	if state.Status != game.StatusFinished || state.Winner != Police {
		t.Fatalf("expected police capture, got status=%q winner=%q", state.Status, state.Winner)
	}
}

func TestBotMovesAreAlwaysConnected(t *testing.T) {
	states := []State{
		{Thief: C, Police: B, Turn: Thief, Status: game.StatusPlaying, Moves: 0},
		{Thief: F, Police: B, Turn: Police, Status: game.StatusPlaying, Moves: 1},
	}
	roles := []Role{Thief, Police}
	for i, state := range states {
		to, ok := ChooseBotMove(state, roles[i])
		if !ok {
			t.Fatalf("no bot move for %q", roles[i])
		}
		from := state.Thief
		if roles[i] == Police {
			from = state.Police
		}
		if !Connected(from, to) {
			t.Fatalf("bot chose unconnected move %s -> %s", from, to)
		}
	}
}

func TestPoliceBotCapturesWhenThiefIsOneEdgeAway(t *testing.T) {
	state := State{Thief: E, Police: B, Turn: Police, Status: game.StatusPlaying}
	to, ok := ChooseBotMove(state, Police)
	if !ok || to != E {
		t.Fatalf("police bot should capture immediately, got %q ok=%v", to, ok)
	}
}
