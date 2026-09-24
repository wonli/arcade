package xiangqi

import (
	"testing"
	"time"

	"github.com/wonli/arcade/game"
)

func TestChooseBotMoveReturnsLegalMove(t *testing.T) {
	state := New("r", "b").State().(State)
	move, ok := ChooseBotMove(state, Red)
	if !ok {
		t.Fatal("expected legal move")
	}
	if !containsMove(LegalMoves(state, Red), move) {
		t.Fatalf("bot chose illegal move: %#v", move)
	}
}

func TestChooseBotMoveReturnsFalseWithoutLegalMove(t *testing.T) {
	state := emptyState(Black)
	state.Status = game.StatusFinished
	if _, ok := ChooseBotMove(state, Black); ok {
		t.Fatal("finished position returned a bot move")
	}
}

func TestChooseBotMoveRespondsPromptlyFromOpening(t *testing.T) {
	state := New("r", "b").State().(State)
	start := time.Now()
	if _, ok := ChooseBotMove(state, Red); !ok {
		t.Fatal("expected opening bot move")
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("opening bot search took too long: %s", elapsed)
	}
}
