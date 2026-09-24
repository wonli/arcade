package xiangqi

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
)

func hasMove(moves []MoveData, from, to Position) bool {
	for _, move := range moves {
		if move.From == from && move.To == to {
			return true
		}
	}
	return false
}

func legalFromState(state State, from, to Position) bool {
	return hasMove(LegalMoves(state, state.Turn), from, to)
}

func withGenerals(turn Color) State {
	s := emptyState(turn)
	s.Board[9][4] = RedGeneral
	s.Board[0][4] = BlackGeneral
	s.Board[5][4] = RedSoldier
	return s
}

func TestInitialStateHasStandardPositionAndRedMovesFirst(t *testing.T) {
	g := New("red-player", "black-player")
	s := g.State().(State)
	if s.Turn != Red || s.Status != game.StatusPlaying || s.Ply != 0 {
		t.Fatalf("unexpected initial state: %#v", s)
	}
	if s.Board[9][4] != RedGeneral || s.Board[0][4] != BlackGeneral {
		t.Fatal("generals misplaced")
	}
	if s.Board[7][1] != RedCannon || s.Board[2][7] != BlackCannon {
		t.Fatal("cannons misplaced")
	}
	if s.Board[6][0] != RedSoldier || s.Board[3][8] != BlackSoldier {
		t.Fatal("soldiers misplaced")
	}
	if len(s.Legal) == 0 {
		t.Fatal("initial legal moves missing")
	}
}

func TestMoveRejectsWrongPlayerAndBadPayload(t *testing.T) {
	g := New("r", "b")
	data, _ := json.Marshal(MoveData{From: Position{0, 6}, To: Position{0, 5}})
	if err := g.Move(game.Move{Player: "b", Data: data}); err == nil {
		t.Fatal("black moved first")
	}
	if err := g.Move(game.Move{Player: "r", Data: []byte("{")}); err == nil {
		t.Fatal("invalid JSON accepted")
	}
}

func TestHorseLegBlocksMove(t *testing.T) {
	s := withGenerals(Red)
	s.Board[4][4] = RedHorse
	s.Board[3][4] = RedSoldier
	moves := horseMoves(s, Position{4, 4}, Red)
	if hasMove(moves, Position{4, 4}, Position{3, 2}) || hasMove(moves, Position{4, 4}, Position{5, 2}) {
		t.Fatal("horse jumped through blocked leg")
	}
	if !hasMove(moves, Position{4, 4}, Position{2, 3}) {
		t.Fatal("unblocked horse move missing")
	}
}

func TestCannonNeedsExactlyOneScreenToCapture(t *testing.T) {
	from := Position{4, 7}
	target := Position{4, 1}

	zero := emptyState(Red)
	zero.Board[9][3] = RedGeneral
	zero.Board[0][4] = BlackGeneral
	zero.Board[from.Y][from.X] = RedCannon
	zero.Board[target.Y][target.X] = BlackChariot
	if hasMove(cannonMoves(zero, from, Red), from, target) {
		t.Fatal("cannon captured without screen")
	}

	one := zero
	one.Board[4][4] = RedSoldier
	if !hasMove(cannonMoves(one, from, Red), from, target) {
		t.Fatal("cannon did not capture over exactly one screen")
	}

	two := one
	two.Board[3][4] = BlackSoldier
	if hasMove(cannonMoves(two, from, Red), from, target) {
		t.Fatal("cannon captured over two screens")
	}
}

func TestCannonNonCaptureCannotJumpScreen(t *testing.T) {
	s := withGenerals(Red)
	from := Position{1, 7}
	s.Board[from.Y][from.X] = RedCannon
	s.Board[5][1] = RedSoldier
	moves := cannonMoves(s, from, Red)
	if !hasMove(moves, from, Position{1, 6}) {
		t.Fatal("normal cannon move missing")
	}
	if hasMove(moves, from, Position{1, 4}) {
		t.Fatal("non-capturing cannon jumped a screen")
	}
}

func TestElephantCannotCrossRiverAndEyeCanBlock(t *testing.T) {
	from := Position{4, 6}
	s := withGenerals(Red)
	s.Board[from.Y][from.X] = RedElephant
	moves := elephantMoves(s, from, Red)
	if hasMove(moves, from, Position{2, 4}) || hasMove(moves, from, Position{6, 4}) {
		t.Fatal("red elephant crossed river")
	}

	s = withGenerals(Red)
	from = Position{2, 9}
	s.Board[from.Y][from.X] = RedElephant
	s.Board[8][3] = RedSoldier
	moves = elephantMoves(s, from, Red)
	if hasMove(moves, from, Position{4, 7}) {
		t.Fatal("elephant moved through blocked eye")
	}
}

func TestAdvisorAndGeneralStayInPalace(t *testing.T) {
	s := withGenerals(Red)
	s.Board[8][4] = RedAdvisor
	advisor := advisorMoves(s, Position{4, 8}, Red)
	for _, move := range advisor {
		if move.To.X < 3 || move.To.X > 5 || move.To.Y < 7 || move.To.Y > 9 {
			t.Fatalf("advisor left palace: %#v", move)
		}
	}

	s.Board[9][4] = 0
	s.Board[8][4] = RedGeneral
	general := generalMoves(s, Position{4, 8}, Red)
	for _, move := range general {
		if move.To != (Position{4, 0}) && (move.To.X < 3 || move.To.X > 5 || move.To.Y < 7 || move.To.Y > 9) {
			t.Fatalf("general left palace: %#v", move)
		}
	}
}

func TestSoldierMovesSidewaysOnlyAfterRiver(t *testing.T) {
	before := withGenerals(Red)
	before.Board[6][2] = RedSoldier
	moves := soldierMoves(before, Position{2, 6}, Red)
	if !hasMove(moves, Position{2, 6}, Position{2, 5}) {
		t.Fatal("forward soldier move missing")
	}
	if hasMove(moves, Position{2, 6}, Position{1, 6}) || hasMove(moves, Position{2, 6}, Position{3, 6}) {
		t.Fatal("soldier moved sideways before river")
	}

	after := withGenerals(Red)
	after.Board[4][2] = RedSoldier
	moves = soldierMoves(after, Position{2, 4}, Red)
	if !hasMove(moves, Position{2, 4}, Position{1, 4}) || !hasMove(moves, Position{2, 4}, Position{3, 4}) {
		t.Fatal("soldier sideways move missing after river")
	}
	if hasMove(moves, Position{2, 4}, Position{2, 5}) {
		t.Fatal("soldier moved backward")
	}
}

func TestFlyingGeneralCreatesAttack(t *testing.T) {
	s := emptyState(Red)
	s.Board[9][4] = RedGeneral
	s.Board[0][4] = BlackGeneral
	if !inCheck(s, Red) || !inCheck(s, Black) {
		t.Fatal("facing generals must attack each other")
	}
}

func TestChariotStopsAtFirstBlocker(t *testing.T) {
	s := withGenerals(Red)
	from := Position{0, 5}
	s.Board[from.Y][from.X] = RedChariot
	s.Board[3][0] = BlackSoldier
	s.Board[2][0] = BlackHorse
	moves := chariotMoves(s, from, Red)
	if !hasMove(moves, from, Position{0, 3}) {
		t.Fatal("first enemy blocker should be capturable")
	}
	if hasMove(moves, from, Position{0, 2}) {
		t.Fatal("chariot moved beyond first blocker")
	}
}

func TestLegalMovesRejectSelfCheck(t *testing.T) {
	s := emptyState(Red)
	s.Board[9][4] = RedGeneral
	s.Board[0][3] = BlackGeneral
	s.Board[0][4] = BlackChariot
	s.Board[5][4] = RedChariot
	if legalFromState(s, Position{4, 5}, Position{3, 5}) {
		t.Fatal("move exposing own general to chariot was legal")
	}
}

func TestGeneralCannotMoveIntoCheck(t *testing.T) {
	s := emptyState(Red)
	s.Board[9][4] = RedGeneral
	s.Board[0][4] = BlackGeneral
	s.Board[8][3] = BlackChariot
	s.Board[5][4] = RedSoldier
	if legalFromState(s, Position{4, 9}, Position{4, 8}) {
		t.Fatal("general moved onto attacked square")
	}
}

func TestCheckFlagTracksNextPlayer(t *testing.T) {
	g := New("r", "b")
	s := emptyState(Red)
	s.Status = game.StatusPlaying
	s.Board[9][4] = RedGeneral
	s.Board[0][4] = BlackGeneral
	s.Board[5][4] = RedSoldier
	s.Board[1][3] = RedChariot
	g.state = s
	g.state.Legal = LegalMoves(g.state, Red)
	data, _ := json.Marshal(MoveData{From: Position{3, 1}, To: Position{4, 1}})
	if err := g.Move(game.Move{Player: "r", Data: data}); err != nil {
		t.Fatal(err)
	}
	state := g.State().(State)
	if !state.Check || state.Turn != Black {
		t.Fatalf("expected black in check: %#v", state)
	}
}

func TestNoLegalMoveWhileInCheckEndsWithOpponentWinner(t *testing.T) {
	g := New("r", "b")
	s := emptyState(Black)
	s.Status = game.StatusPlaying
	s.Board[0][4] = BlackGeneral
	s.Board[9][4] = RedGeneral
	s.Board[2][4] = RedChariot
	s.Board[1][3] = RedChariot
	s.Board[1][5] = RedChariot
	g.state = s
	g.finishIfNeeded()
	state := g.State().(State)
	if state.Status != game.StatusFinished || state.Winner != Red {
		t.Fatalf("expected red win: %#v", state)
	}
}

func TestGeneralsMayNotFaceAfterMove(t *testing.T) {
	s := emptyState(Red)
	s.Board[9][4] = RedGeneral
	s.Board[0][4] = BlackGeneral
	s.Board[5][4] = RedChariot
	if legalFromState(s, Position{4, 5}, Position{3, 5}) {
		t.Fatal("moving the only blocker between generals was legal")
	}
}

func TestResignAwardsOpponentAndClearsLegalMoves(t *testing.T) {
	g := New("r", "b")
	if err := g.Resign("r"); err != nil {
		t.Fatal(err)
	}
	s := g.State().(State)
	if s.Status != game.StatusFinished || s.Winner != Black || s.DrawReason != "resignation" || s.Check || len(s.Legal) != 0 {
		t.Fatalf("unexpected resign state: %#v", s)
	}
}

func TestResetRestoresInitialStateAfterFinishedGame(t *testing.T) {
	g := New("r", "b")
	_ = g.Resign("r")
	g.Reset()
	s := g.State().(State)
	if s.Status != game.StatusPlaying || s.Turn != Red || s.Winner != "" || s.DrawReason != "" || s.Last != nil || s.Check || s.Ply != 0 || len(s.Legal) == 0 {
		t.Fatalf("reset left stale state: %#v", s)
	}
}
