package arcade

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/gomoku"
)

func TestJoinSecondPlayerStartsGomoku(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}

	if err := s.Join(r.ID, game.PlayerID("p1"), "Player 1"); err != nil {
		t.Fatal(err)
	}
	if r.Game() != nil {
		t.Fatal("game started before second player joined")
	}

	if err := s.Join(r.ID, game.PlayerID("p2"), "Player 2"); err != nil {
		t.Fatal(err)
	}
	if r.Game() == nil {
		t.Fatal("game did not start after second player joined")
	}
	if r.Game().Name() != "gomoku" {
		t.Fatalf("game = %q, want gomoku", r.Game().Name())
	}
}

func TestCreateTetrisRoomKeepsSimulationClientSide(t *testing.T) {
	s := NewService()
	r, err := s.Create("tetris")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil {
		t.Fatal(err)
	}
	if r.GameName != "tetris" {
		t.Fatalf("game = %q, want tetris", r.GameName)
	}
	if r.Game() != nil {
		t.Fatal("tetris room should not create a server-side game simulation")
	}
}

func TestMoveUpdatesAuthoritativeState(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil {
		t.Fatal(err)
	}

	payload, _ := json.Marshal(gomoku.Position{X: 7, Y: 7})
	if err := s.Move(r.ID, "p1", payload); err != nil {
		t.Fatal(err)
	}

	state := r.Game().State().(gomoku.State)
	if state.Board[7][7] != gomoku.Black {
		t.Fatalf("board[7][7] = %v, want black", state.Board[7][7])
	}
	if state.Turn != gomoku.White {
		t.Fatalf("turn = %v, want white", state.Turn)
	}
}

func TestMoveRejectsPlayerOutsideRoom(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}
	_ = s.Join(r.ID, "p1", "Player 1")
	_ = s.Join(r.ID, "p2", "Player 2")

	payload, _ := json.Marshal(gomoku.Position{X: 7, Y: 7})
	if err := s.Move(r.ID, "intruder", payload); err == nil {
		t.Fatal("expected outsider move to fail")
	}
}

func TestAddBotStartsGomokuAsSecondPlayer(t *testing.T) {
	s := NewService()
	r, err := s.Create("gomoku")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}

	if err := s.AddBot(r.ID, "p1"); err != nil {
		t.Fatal(err)
	}
	if r.Game() == nil {
		t.Fatal("game did not start after bot joined")
	}
	if len(r.Players) != 2 || !r.Players[1].Bot {
		t.Fatalf("players = %#v, want bot as second player", r.Players)
	}
}

func TestAddBotRequiresFirstPlayerAndEmptySeat(t *testing.T) {
	s := NewService()
	r, _ := s.Create("gomoku")
	_ = s.Join(r.ID, "p1", "Player 1")

	if err := s.AddBot(r.ID, "other"); err == nil {
		t.Fatal("expected non-owner add bot to fail")
	}
	_ = s.Join(r.ID, "p2", "Player 2")
	if err := s.AddBot(r.ID, "p1"); err == nil {
		t.Fatal("expected add bot to full room to fail")
	}
}

func TestBotRepliesAfterHumanMove(t *testing.T) {
	s := NewService()
	r, _ := s.Create("gomoku")
	_ = s.Join(r.ID, "p1", "Player 1")
	if err := s.AddBot(r.ID, "p1"); err != nil {
		t.Fatal(err)
	}

	payload, _ := json.Marshal(gomoku.Position{X: 7, Y: 7})
	if err := s.Move(r.ID, "p1", payload); err != nil {
		t.Fatal(err)
	}

	state := r.Game().State().(gomoku.State)
	if state.Moves != 2 {
		t.Fatalf("moves = %d, want human move plus bot reply", state.Moves)
	}
	if state.Turn != gomoku.Black {
		t.Fatalf("turn = %v, want black after bot reply", state.Turn)
	}
}

func TestRematchResetsFinishedGomoku(t *testing.T) {
	s := NewService()
	r, _ := s.Create("gomoku")
	_ = s.Join(r.ID, "p1", "Player 1")
	_ = s.Join(r.ID, "p2", "Player 2")

	moves := []struct {
		player game.PlayerID
		x, y   int
	}{
		{"p1", 0, 0}, {"p2", 0, 1},
		{"p1", 1, 0}, {"p2", 1, 1},
		{"p1", 2, 0}, {"p2", 2, 1},
		{"p1", 3, 0}, {"p2", 3, 1},
		{"p1", 4, 0},
	}
	for _, move := range moves {
		payload, _ := json.Marshal(gomoku.Position{X: move.x, Y: move.y})
		if err := s.Move(r.ID, move.player, payload); err != nil {
			t.Fatal(err)
		}
	}

	if err := s.Rematch(r.ID, "p1"); err != nil {
		t.Fatal(err)
	}
	state := r.Game().State().(gomoku.State)
	if state.Status != game.StatusPlaying || state.Moves != 0 || state.Winner != gomoku.Empty || state.Last != nil {
		t.Fatalf("state = %#v, want fresh playing game", state)
	}
}

func TestRematchRequiresFinishedGameAndPlayer(t *testing.T) {
	s := NewService()
	r, _ := s.Create("gomoku")
	_ = s.Join(r.ID, "p1", "Player 1")
	_ = s.Join(r.ID, "p2", "Player 2")

	if err := s.Rematch(r.ID, "p1"); err == nil {
		t.Fatal("expected rematch before finish to fail")
	}
	if err := s.Rematch(r.ID, "other"); err == nil {
		t.Fatal("expected outsider rematch to fail")
	}
}
