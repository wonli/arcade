package chess

import (
	"encoding/json"
	"testing"

	"github.com/wonli/arcade/game"
)

func play(t *testing.T, g *Game, player game.PlayerID, fromX, fromY, toX, toY int, promotion ...string) {
	t.Helper()
	move := MoveData{From: Position{X: fromX, Y: fromY}, To: Position{X: toX, Y: toY}}
	if len(promotion) > 0 { move.Promotion = promotion[0] }
	payload, err := json.Marshal(move)
	if err != nil { t.Fatal(err) }
	if err := g.Move(game.Move{Player: player, Data: payload}); err != nil { t.Fatalf("move %+v failed: %v", move, err) }
}

func TestInitialPositionHasTwentyLegalMoves(t *testing.T) {
	g := New("white", "black")
	if got := len(LegalMoves(g.state, White)); got != 20 { t.Fatalf("got %d legal moves, want 20", got) }
}

func TestFoolsMateEndsGameInCheckmate(t *testing.T) {
	g := New("white", "black")
	play(t, g, "white", 5, 6, 5, 5)
	play(t, g, "black", 4, 1, 4, 3)
	play(t, g, "white", 6, 6, 6, 4)
	play(t, g, "black", 3, 0, 7, 4)
	if g.state.Status != game.StatusFinished { t.Fatalf("status=%s", g.state.Status) }
	if g.state.Winner != Black { t.Fatalf("winner=%s", g.state.Winner) }
}

func TestCastlingMovesRookAndKing(t *testing.T) {
	s := emptyState(White)
	s.Board[7][4], s.Board[7][7], s.Board[0][4] = WhiteKing, WhiteRook, BlackKing
	s.Castling.WhiteKingSide = true
	next, err := applyLegalMove(s, MoveData{From: Position{4,7}, To: Position{6,7}})
	if err != nil { t.Fatal(err) }
	if next.Board[7][6] != WhiteKing || next.Board[7][5] != WhiteRook || next.Board[7][7] != Empty { t.Fatal("castling board incorrect") }
}

func TestEnPassantCapture(t *testing.T) {
	s := emptyState(Black)
	s.Board[7][4], s.Board[0][4] = WhiteKing, BlackKing
	s.Board[3][4], s.Board[1][3] = WhitePawn, BlackPawn
	next, err := applyLegalMove(s, MoveData{From: Position{3,1}, To: Position{3,3}})
	if err != nil { t.Fatal(err) }
	next, err = applyLegalMove(next, MoveData{From: Position{4,3}, To: Position{3,2}})
	if err != nil { t.Fatal(err) }
	if next.Board[2][3] != WhitePawn || next.Board[3][3] != Empty { t.Fatal("en passant capture not applied") }
}

func TestPromotionDefaultsToQueen(t *testing.T) {
	s := emptyState(White)
	s.Board[7][4], s.Board[0][4], s.Board[1][0] = WhiteKing, BlackKing, WhitePawn
	next, err := applyLegalMove(s, MoveData{From: Position{0,1}, To: Position{0,0}})
	if err != nil { t.Fatal(err) }
	if next.Board[0][0] != WhiteQueen { t.Fatalf("piece=%d want queen", next.Board[0][0]) }
}

func TestIllegalMoveCannotLeaveOwnKingInCheck(t *testing.T) {
	s := emptyState(White)
	s.Board[7][4], s.Board[6][4], s.Board[0][4], s.Board[0][0] = WhiteKing, WhiteRook, BlackRook, BlackKing
	if _, err := applyLegalMove(s, MoveData{From: Position{4,6}, To: Position{5,6}}); err == nil { t.Fatal("expected pinned rook move to be rejected") }
}
