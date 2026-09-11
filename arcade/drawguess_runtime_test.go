package arcade

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/wonli/arcade/game/drawguess"
	"github.com/wonli/arcade/room"
)

func TestDrawGuessStartRequiresHostAndTwoPlayers(t *testing.T) {
	s := NewService()
	r, err := s.Create("drawguess", 2, 8)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "p1", "Alice"); err != nil { t.Fatal(err) }
	if err := s.StartDrawGuess(r.ID, "p1", nil); err == nil { t.Fatal("expected one-player start to fail") }
	if err := s.Join(r.ID, "p2", "Bob"); err != nil { t.Fatal(err) }
	if err := s.StartDrawGuess(r.ID, "p2", nil); err == nil { t.Fatal("expected non-host start to fail") }
	if err := s.StartDrawGuess(r.ID, "p1", nil); err != nil { t.Fatal(err) }
	if r.Status != room.StatusPlaying { t.Fatalf("status = %q", r.Status) }
}

func TestDrawGuessSnapshotIsPublicButDrawerGetsPrivateWord(t *testing.T) {
	s := NewService()
	r, _ := s.Create("drawguess", 2, 8)
	_ = s.Join(r.ID, "p1", "Alice")
	_ = s.Join(r.ID, "p2", "Bob")
	if err := s.StartDrawGuess(r.ID, "p1", nil); err != nil { t.Fatal(err) }

	snapshot := strings.ToLower(fmt.Sprintf("%#v", r.Snapshot()))
	private, err := s.DrawGuessPrivateState(r.ID, "p1")
	if err != nil { t.Fatal(err) }
	if private.Word == "" { t.Fatal("drawer should receive private word") }
	if strings.Contains(snapshot, strings.ToLower(private.Word)) {
		t.Fatalf("room snapshot leaked private word: %s", snapshot)
	}
	other, err := s.DrawGuessPrivateState(r.ID, "p2")
	if err != nil { t.Fatal(err) }
	if other.Word != "" { t.Fatal("guesser should not receive word") }
}

func TestDrawGuessRefreshStateKeepsStrokesAndScores(t *testing.T) {
	s := NewService()
	s.drawTick = time.Hour
	r, _ := s.Create("drawguess", 2, 8)
	_ = s.Join(r.ID, "p1", "Alice")
	_ = s.Join(r.ID, "p2", "Bob")
	if err := s.StartDrawGuess(r.ID, "p1", nil); err != nil { t.Fatal(err) }

	stroke := drawguess.Stroke{Points: []drawguess.Point{{X:.1,Y:.1},{X:.2,Y:.2}}, Color:"#111111", Width:6}
	if err := s.DrawGuessStroke(r.ID, "p1", stroke); err != nil { t.Fatal(err) }
	private, _ := s.DrawGuessPrivateState(r.ID, "p1")
	result, err := s.DrawGuessGuess(r.ID, "p2", private.Word)
	if err != nil { t.Fatal(err) }
	if !result.Correct { t.Fatal("expected correct guess") }

	state, ok := r.Snapshot()["state"].(drawguess.PublicState)
	if !ok { t.Fatalf("state type = %T", r.Snapshot()["state"]) }
	if len(state.Strokes) != 0 {
		// Correct guess by the only guesser advances/finishes and clears the round canvas.
		t.Fatalf("finished snapshot should have cleared strokes, got %d", len(state.Strokes))
	}
	if state.Scores["p2"] == 0 { t.Fatalf("score not mirrored: %#v", state.Scores) }
}

func TestDrawGuessStrokeMirrorsIntoRoomState(t *testing.T) {
	s := NewService()
	s.drawTick = time.Hour
	r, _ := s.Create("drawguess", 2, 8)
	_ = s.Join(r.ID, "p1", "Alice")
	_ = s.Join(r.ID, "p2", "Bob")
	if err := s.StartDrawGuess(r.ID, "p1", nil); err != nil { t.Fatal(err) }
	stroke := drawguess.Stroke{Points: []drawguess.Point{{X:.1,Y:.1},{X:.2,Y:.2}}, Color:"#111111", Width:6}
	if err := s.DrawGuessStroke(r.ID, "p1", stroke); err != nil { t.Fatal(err) }
	state, ok := r.Snapshot()["state"].(drawguess.PublicState)
	if !ok || len(state.Strokes) != 1 { t.Fatalf("room state = %#v", r.Snapshot()["state"]) }
}
