package gomoku

import "testing"

func TestChooseBotMoveTakesImmediateWin(t *testing.T) {
	state := State{Turn: White}
	for x := 3; x <= 6; x++ {
		state.Board[7][x] = White
	}

	pos, ok := ChooseBotMove(state, White)
	if !ok {
		t.Fatal("expected a bot move")
	}
	if !((pos.X == 2 || pos.X == 7) && pos.Y == 7) {
		t.Fatalf("move = %#v, want immediate winning end", pos)
	}
}

func TestChooseBotMoveBlocksImmediateLoss(t *testing.T) {
	state := State{Turn: White}
	for x := 3; x <= 6; x++ {
		state.Board[7][x] = Black
	}

	pos, ok := ChooseBotMove(state, White)
	if !ok {
		t.Fatal("expected a bot move")
	}
	if !((pos.X == 2 || pos.X == 7) && pos.Y == 7) {
		t.Fatalf("move = %#v, want immediate blocking end", pos)
	}
}
