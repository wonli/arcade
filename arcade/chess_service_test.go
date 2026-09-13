package arcade

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/chess"
)

func TestChessBotDifficultyAndReply(t *testing.T) {
	s := NewService()
	r, err := s.Create("chess", 2)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil { t.Fatal(err) }
	if err := s.AddBot(r.ID, "p1", "hard"); err != nil { t.Fatal(err) }
	if !r.Players[1].Bot || r.Players[1].BotDifficulty != "hard" { t.Fatalf("bot = %#v", r.Players[1]) }
	payload, _ := json.Marshal(chess.MoveData{From: chess.Position{X:4,Y:6}, To: chess.Position{X:4,Y:4}})
	if err := s.Move(r.ID, "p1", payload); err != nil { t.Fatal(err) }
	state := r.Game().State().(chess.State)
	if state.Ply != 2 { t.Fatalf("ply = %d, want human move plus bot reply", state.Ply) }
	if state.Turn != chess.White { t.Fatalf("turn = %s, want white", state.Turn) }
}

func TestChessTwoPlayersStartAuthoritativeGame(t *testing.T) {
	s := NewService()
	r, err := s.Create("chess", 2)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil { t.Fatal(err) }
	if r.Started() { t.Fatal("chess room started before second player joined") }
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil { t.Fatal(err) }
	if !r.Started() || r.Game() == nil || r.Game().Name() != "chess" { t.Fatal("chess room did not start after second player joined") }
}

func TestChessResignAwardsWinToOpponent(t *testing.T) {
	s := NewService()
	r, err := s.Create("chess", 2)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil { t.Fatal(err) }
	if err := s.Resign(r.ID, "p1"); err != nil { t.Fatal(err) }
	state := r.Game().State().(chess.State)
	if state.Status != game.StatusFinished { t.Fatalf("status = %s", state.Status) }
	if state.Winner != chess.Black { t.Fatalf("winner = %s, want black", state.Winner) }
	if state.EndReason != "resignation" { t.Fatalf("endReason = %q", state.EndReason) }
}
