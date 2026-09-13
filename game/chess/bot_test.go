package chess

import "testing"

func TestBotReturnsLegalMoveAtEveryDifficulty(t *testing.T) {
	state := initialState()
	for _, level := range []Difficulty{Easy, Medium, Hard, Expert} {
		move, ok := ChooseBotMove(state, White, level)
		if !ok { t.Fatalf("difficulty %s returned no move", level) }
		if !containsMove(LegalMoves(state, White), normalizePromotion(move)) { t.Fatalf("difficulty %s returned illegal move %+v", level, move) }
	}
}

func TestNormalizeDifficultyFallsBackToMedium(t *testing.T) {
	if got := NormalizeDifficulty("nonsense"); got != Medium { t.Fatalf("got %s", got) }
	if got := NormalizeDifficulty("HARD"); got != Hard { t.Fatalf("got %s", got) }
}
