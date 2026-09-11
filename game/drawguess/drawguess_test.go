package drawguess

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/wonli/arcade/game"
)

func testNow() (time.Time, func() time.Time) {
	now := time.Date(2026, 9, 11, 8, 0, 0, 0, time.UTC)
	return now, func() time.Time { return now }
}

func testPlayers() []Player {
	return []Player{{ID: "p1", Name: "Alice"}, {ID: "p2", Name: "Bob"}, {ID: "p3", Name: "Cara"}}
}

func TestStartRequiresTwoPlayers(t *testing.T) {
	_, now := testNow()
	g := New([]Player{{ID: "p1", Name: "Alice"}}, []string{"giraffe"}, now)
	if err := g.Start(); err == nil {
		t.Fatal("expected one-player game to fail")
	}
}

func TestPublicStateNeverContainsAnswer(t *testing.T) {
	_, now := testNow()
	g := New(testPlayers()[:2], []string{"giraffe"}, now)
	if err := g.Start(); err != nil { t.Fatal(err) }
	got := strings.ToLower(fmt.Sprintf("%#v", g.PublicState()))
	if strings.Contains(got, "giraffe") {
		t.Fatalf("public state leaked answer: %s", got)
	}
	if g.PrivateState("p1").Word != "giraffe" {
		t.Fatal("drawer did not receive answer")
	}
	if g.PrivateState("p2").Word != "" {
		t.Fatal("guesser received answer")
	}
}

func TestOnlyDrawerCanStrokeAndClear(t *testing.T) {
	_, now := testNow()
	g := New(testPlayers()[:2], []string{"giraffe"}, now)
	if err := g.Start(); err != nil { t.Fatal(err) }
	stroke := Stroke{Points: []Point{{X: .1, Y: .1}, {X: .2, Y: .2}}, Color: "#111111", Width: 6}
	if err := g.Stroke("p2", stroke); err == nil { t.Fatal("guesser should not draw") }
	if err := g.Stroke("p1", stroke); err != nil { t.Fatalf("drawer stroke failed: %v", err) }
	if len(g.PublicState().Strokes) != 1 { t.Fatal("stroke was not persisted") }
	if err := g.Clear("p2"); err == nil { t.Fatal("guesser should not clear") }
	if err := g.Clear("p1"); err != nil { t.Fatalf("drawer clear failed: %v", err) }
	if len(g.PublicState().Strokes) != 0 { t.Fatal("clear did not reset strokes") }
}

func TestStrokeValidation(t *testing.T) {
	_, now := testNow()
	g := New(testPlayers()[:2], []string{"giraffe"}, now)
	_ = g.Start()
	cases := []Stroke{
		{Points: []Point{{X: .1, Y: .1}}, Color: "#111111", Width: 6},
		{Points: []Point{{X: -.1, Y: .1}, {X: .2, Y: .2}}, Color: "#111111", Width: 6},
		{Points: []Point{{X: .1, Y: .1}, {X: .2, Y: .2}}, Color: "#111111", Width: 0},
		{Points: []Point{{X: .1, Y: .1}, {X: .2, Y: .2}}, Color: "#bad", Width: 6},
	}
	for i, stroke := range cases {
		if err := g.Stroke("p1", stroke); err == nil {
			t.Fatalf("case %d should fail", i)
		}
	}
}

func TestWrongGuessIsChatAndCorrectGuessIsRedactedAndScores(t *testing.T) {
	start, _ := testNow()
	now := start.Add(30 * time.Second)
	g := New(testPlayers()[:2], []string{"giraffe"}, func() time.Time { return now })
	g.startedAt = start
	if err := g.Start(); err != nil { t.Fatal(err) }
	g.deadline = start.Add(60 * time.Second)

	wrong := g.Guess("p2", "elephant")
	if wrong.Correct || wrong.Chat != "elephant" { t.Fatalf("wrong guess = %#v", wrong) }

	correct := g.Guess("p2", " GIRAFFE ")
	if !correct.Correct { t.Fatal("expected correct guess") }
	if correct.Chat != "" { t.Fatalf("correct answer leaked to chat: %q", correct.Chat) }
	if correct.Score < 50 || correct.Score > 100 { t.Fatalf("score = %d, want 50..100", correct.Score) }
	state := g.PublicState()
	if state.Scores["p1"] != 30 { t.Fatalf("drawer score = %d, want 30", state.Scores["p1"]) }
	if state.Scores["p2"] != correct.Score { t.Fatalf("guesser score mismatch: %#v", state.Scores) }
}

func TestPlayerScoresOnlyOncePerRound(t *testing.T) {
	_, now := testNow()
	g := New(testPlayers(), []string{"giraffe", "rocket", "piano"}, now)
	if err := g.Start(); err != nil { t.Fatal(err) }
	first := g.Guess("p2", "giraffe")
	second := g.Guess("p2", "giraffe")
	if !first.Correct { t.Fatal("first guess should be correct") }
	if second.Correct || second.Score != 0 { t.Fatalf("duplicate result = %#v", second) }
}

func TestAllGuessersCorrectAdvancesRound(t *testing.T) {
	_, now := testNow()
	g := New(testPlayers(), []string{"giraffe", "rocket", "piano"}, now)
	if err := g.Start(); err != nil { t.Fatal(err) }
	if !g.Guess("p2", "giraffe").Correct { t.Fatal("p2 should guess") }
	result := g.Guess("p3", "giraffe")
	if !result.Correct || !result.RoundAdvanced { t.Fatalf("result = %#v", result) }
	state := g.PublicState()
	if state.Round != 2 || state.DrawerID != game.PlayerID("p2") { t.Fatalf("state = %#v", state) }
	if len(state.Strokes) != 0 { t.Fatal("new round should clear strokes") }
}

func TestAdvanceIfExpiredMovesRoundAndFinishesAfterEveryDrawer(t *testing.T) {
	nowValue, _ := testNow()
	now := func() time.Time { return nowValue }
	g := New(testPlayers()[:2], []string{"giraffe", "rocket"}, now)
	if err := g.Start(); err != nil { t.Fatal(err) }

	nowValue = nowValue.Add(61 * time.Second)
	if !g.AdvanceIfExpired() { t.Fatal("expected first timeout to advance") }
	if g.PublicState().Round != 2 { t.Fatalf("round = %d", g.PublicState().Round) }

	nowValue = nowValue.Add(61 * time.Second)
	if !g.AdvanceIfExpired() { t.Fatal("expected second timeout to finish") }
	state := g.PublicState()
	if state.Status != "finished" { t.Fatalf("status = %q", state.Status) }
	if len(state.Winners) == 0 { t.Fatal("expected at least one winner") }
}
