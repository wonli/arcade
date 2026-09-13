package chess

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/wonli/arcade/game"
)

type Color string

const (
	White Color = "white"
	Black Color = "black"
)

const (
	Empty       = 0
	WhitePawn   = 1
	WhiteKnight = 2
	WhiteBishop = 3
	WhiteRook   = 4
	WhiteQueen  = 5
	WhiteKing   = 6
	BlackPawn   = -1
	BlackKnight = -2
	BlackBishop = -3
	BlackRook   = -4
	BlackQueen  = -5
	BlackKing   = -6
)

type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type MoveData struct {
	From      Position `json:"from"`
	To        Position `json:"to"`
	Promotion string   `json:"promotion,omitempty"`
}

type CastlingRights struct {
	WhiteKingSide  bool `json:"whiteKingSide"`
	WhiteQueenSide bool `json:"whiteQueenSide"`
	BlackKingSide  bool `json:"blackKingSide"`
	BlackQueenSide bool `json:"blackQueenSide"`
}

type State struct {
	Board      [8][8]int      `json:"board"`
	Turn       Color          `json:"turn"`
	Winner     Color          `json:"winner,omitempty"`
	Status     game.Status    `json:"status"`
	Last       *MoveData      `json:"last,omitempty"`
	Check      bool           `json:"check"`
	Ply        int            `json:"ply"`
	Castling   CastlingRights `json:"castling"`
	EnPassant  *Position      `json:"enPassant,omitempty"`
	Halfmove   int            `json:"halfmove"`
	DrawReason string         `json:"drawReason,omitempty"`
	Legal      []MoveData     `json:"legalMoves,omitempty"`
}

type Game struct {
	state      State
	players    map[game.PlayerID]Color
	repetition map[string]int
}

func New(white, black game.PlayerID) *Game {
	g := &Game{players: map[game.PlayerID]Color{white: White, black: Black}}
	g.Reset()
	return g
}

func (g *Game) Name() string        { return "chess" }
func (g *Game) Status() game.Status { return g.state.Status }
func (g *Game) State() any          { return g.state }

func (g *Game) Reset() {
	g.state = initialState()
	g.repetition = map[string]int{positionKey(g.state): 1}
}

func initialState() State {
	s := emptyState(White)
	s.Status = game.StatusPlaying
	s.Castling = CastlingRights{true, true, true, true}
	s.Board[0] = [8]int{BlackRook, BlackKnight, BlackBishop, BlackQueen, BlackKing, BlackBishop, BlackKnight, BlackRook}
	s.Board[1] = [8]int{BlackPawn, BlackPawn, BlackPawn, BlackPawn, BlackPawn, BlackPawn, BlackPawn, BlackPawn}
	s.Board[6] = [8]int{WhitePawn, WhitePawn, WhitePawn, WhitePawn, WhitePawn, WhitePawn, WhitePawn, WhitePawn}
	s.Board[7] = [8]int{WhiteRook, WhiteKnight, WhiteBishop, WhiteQueen, WhiteKing, WhiteBishop, WhiteKnight, WhiteRook}
	s.Legal = LegalMoves(s, White)
	return s
}

func emptyState(turn Color) State { return State{Turn: turn, Status: game.StatusPlaying} }

func (g *Game) Move(m game.Move) error {
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}
	color, ok := g.players[m.Player]
	if !ok {
		return errors.New("player is not in this game")
	}
	if color != g.state.Turn {
		return errors.New("not your turn")
	}
	var move MoveData
	if err := json.Unmarshal(m.Data, &move); err != nil {
		return fmt.Errorf("invalid move: %w", err)
	}
	move = normalizePromotion(move)
	next, err := applyLegalMove(g.state, move)
	if err != nil {
		return err
	}
	g.state = next
	key := positionKey(g.state)
	g.repetition[key]++
	g.finishIfNeeded()
	return nil
}

func (g *Game) finishIfNeeded() {
	if g.state.Status != game.StatusPlaying {
		return
	}
	moves := LegalMoves(g.state, g.state.Turn)
	g.state.Check = inCheck(g.state, g.state.Turn)
	if len(moves) == 0 {
		g.state.Status = game.StatusFinished
		if g.state.Check {
			g.state.Winner = opposite(g.state.Turn)
		} else {
			g.state.DrawReason = "stalemate"
		}
		return
	}
	if g.state.Halfmove >= 100 {
		g.state.Status = game.StatusFinished
		g.state.DrawReason = "fifty-move"
		return
	}
	if insufficientMaterial(g.state) {
		g.state.Status = game.StatusFinished
		g.state.DrawReason = "insufficient-material"
		return
	}
	if g.repetition[positionKey(g.state)] >= 3 {
		g.state.Status = game.StatusFinished
		g.state.DrawReason = "threefold-repetition"
	}
}

func LegalMoves(state State, color Color) []MoveData {
	if color != White && color != Black {
		return nil
	}
	moves := pseudoMoves(state, color)
	legal := make([]MoveData, 0, len(moves))
	for _, move := range moves {
		next := makeMoveUnchecked(state, move)
		if !inCheck(next, color) {
			legal = append(legal, move)
		}
	}
	return legal
}

func applyLegalMove(state State, move MoveData) (State, error) {
	move = normalizePromotion(move)
	if !inBounds(move.From.X, move.From.Y) || !inBounds(move.To.X, move.To.Y) {
		return state, errors.New("position out of board")
	}
	piece := state.Board[move.From.Y][move.From.X]
	if piece == Empty || colorOf(piece) != state.Turn {
		return state, errors.New("invalid source piece")
	}
	if !containsMove(LegalMoves(state, state.Turn), move) {
		return state, errors.New("illegal move")
	}
	next := makeMoveUnchecked(state, move)
	next.Check = inCheck(next, next.Turn)
	next.Legal = LegalMoves(next, next.Turn)
	return next, nil
}

func containsMove(moves []MoveData, target MoveData) bool {
	for _, move := range moves {
		if sameMove(move, target) {
			return true
		}
	}
	return false
}

func sameMove(a, b MoveData) bool {
	a = normalizePromotion(a)
	b = normalizePromotion(b)
	return a.From == b.From && a.To == b.To && a.Promotion == b.Promotion
}

func normalizePromotion(move MoveData) MoveData {
	move.Promotion = strings.ToLower(strings.TrimSpace(move.Promotion))
	if move.Promotion == "" {
		move.Promotion = "q"
	}
	switch move.Promotion {
	case "queen":
		move.Promotion = "q"
	case "rook":
		move.Promotion = "r"
	case "bishop":
		move.Promotion = "b"
	case "knight":
		move.Promotion = "n"
	}
	return move
}

func pseudoMoves(state State, color Color) []MoveData {
	moves := make([]MoveData, 0, 48)
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			piece := state.Board[y][x]
			if piece == Empty || colorOf(piece) != color {
				continue
			}
			from := Position{x, y}
			switch abs(piece) {
			case 1:
				moves = append(moves, pawnMoves(state, from, color)...)
			case 2:
				for _, d := range [][2]int{{1, 2}, {2, 1}, {-1, 2}, {-2, 1}, {1, -2}, {2, -1}, {-1, -2}, {-2, -1}} {
					moves = appendStep(state, moves, from, x+d[0], y+d[1], color)
				}
			case 3:
				moves = append(moves, slidingMoves(state, from, color, [][2]int{{1, 1}, {1, -1}, {-1, 1}, {-1, -1}})...)
			case 4:
				moves = append(moves, slidingMoves(state, from, color, [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}})...)
			case 5:
				moves = append(moves, slidingMoves(state, from, color, [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}, {1, 1}, {1, -1}, {-1, 1}, {-1, -1}})...)
			case 6:
				for dy := -1; dy <= 1; dy++ {
					for dx := -1; dx <= 1; dx++ {
						if dx != 0 || dy != 0 {
							moves = appendStep(state, moves, from, x+dx, y+dy, color)
						}
					}
				}
				moves = append(moves, castlingMoves(state, color)...)
			}
		}
	}
	return moves
}

func pawnMoves(state State, from Position, color Color) []MoveData {
	dir, start, promote := -1, 6, 0
	if color == Black {
		dir, start, promote = 1, 1, 7
	}
	moves := make([]MoveData, 0, 4)
	y1 := from.Y + dir
	if inBounds(from.X, y1) && state.Board[y1][from.X] == Empty {
		moves = appendPawnMove(moves, from, Position{from.X, y1}, y1 == promote)
		y2 := from.Y + 2*dir
		if from.Y == start && state.Board[y2][from.X] == Empty {
			moves = append(moves, MoveData{From: from, To: Position{from.X, y2}, Promotion: "q"})
		}
	}
	for _, dx := range []int{-1, 1} {
		x, y := from.X+dx, from.Y+dir
		if !inBounds(x, y) {
			continue
		}
		target := state.Board[y][x]
		if target != Empty && colorOf(target) != color {
			moves = appendPawnMove(moves, from, Position{x, y}, y == promote)
			continue
		}
		if target == Empty && state.EnPassant != nil && state.EnPassant.X == x && state.EnPassant.Y == y {
			moves = append(moves, MoveData{From: from, To: Position{x, y}, Promotion: "q"})
		}
	}
	return moves
}

func appendPawnMove(moves []MoveData, from, to Position, promotion bool) []MoveData {
	if !promotion {
		return append(moves, MoveData{From: from, To: to, Promotion: "q"})
	}
	for _, p := range []string{"q", "r", "b", "n"} {
		moves = append(moves, MoveData{From: from, To: to, Promotion: p})
	}
	return moves
}

func slidingMoves(state State, from Position, color Color, directions [][2]int) []MoveData {
	moves := make([]MoveData, 0, 16)
	for _, d := range directions {
		for x, y := from.X+d[0], from.Y+d[1]; inBounds(x, y); x, y = x+d[0], y+d[1] {
			target := state.Board[y][x]
			if target == Empty {
				moves = append(moves, MoveData{From: from, To: Position{x, y}, Promotion: "q"})
				continue
			}
			if colorOf(target) != color {
				moves = append(moves, MoveData{From: from, To: Position{x, y}, Promotion: "q"})
			}
			break
		}
	}
	return moves
}

func appendStep(state State, moves []MoveData, from Position, x, y int, color Color) []MoveData {
	if !inBounds(x, y) {
		return moves
	}
	target := state.Board[y][x]
	if target == Empty || colorOf(target) != color {
		moves = append(moves, MoveData{From: from, To: Position{x, y}, Promotion: "q"})
	}
	return moves
}

func castlingMoves(state State, color Color) []MoveData {
	y, king, rook := 7, WhiteKing, WhiteRook
	kingSide, queenSide := state.Castling.WhiteKingSide, state.Castling.WhiteQueenSide
	if color == Black {
		y, king, rook = 0, BlackKing, BlackRook
		kingSide, queenSide = state.Castling.BlackKingSide, state.Castling.BlackQueenSide
	}
	if state.Board[y][4] != king || inCheck(state, color) {
		return nil
	}
	moves := make([]MoveData, 0, 2)
	opponent := opposite(color)
	if kingSide && state.Board[y][7] == rook && state.Board[y][5] == Empty && state.Board[y][6] == Empty && !isSquareAttacked(state, 5, y, opponent) && !isSquareAttacked(state, 6, y, opponent) {
		moves = append(moves, MoveData{From: Position{4, y}, To: Position{6, y}, Promotion: "q"})
	}
	if queenSide && state.Board[y][0] == rook && state.Board[y][1] == Empty && state.Board[y][2] == Empty && state.Board[y][3] == Empty && !isSquareAttacked(state, 3, y, opponent) && !isSquareAttacked(state, 2, y, opponent) {
		moves = append(moves, MoveData{From: Position{4, y}, To: Position{2, y}, Promotion: "q"})
	}
	return moves
}

func makeMoveUnchecked(state State, move MoveData) State {
	move = normalizePromotion(move)
	next := state
	piece := next.Board[move.From.Y][move.From.X]
	target := next.Board[move.To.Y][move.To.X]
	color := colorOf(piece)
	capture := target != Empty
	next.EnPassant = nil

	if abs(piece) == 1 && move.To.X != move.From.X && target == Empty {
		captureY := move.To.Y + 1
		if color == Black {
			captureY = move.To.Y - 1
		}
		if inBounds(move.To.X, captureY) {
			next.Board[captureY][move.To.X] = Empty
			capture = true
		}
	}

	next.Board[move.From.Y][move.From.X] = Empty
	next.Board[move.To.Y][move.To.X] = piece

	if abs(piece) == 6 && abs(move.To.X-move.From.X) == 2 {
		if move.To.X == 6 {
			next.Board[move.To.Y][5] = next.Board[move.To.Y][7]
			next.Board[move.To.Y][7] = Empty
		} else {
			next.Board[move.To.Y][3] = next.Board[move.To.Y][0]
			next.Board[move.To.Y][0] = Empty
		}
	}

	if abs(piece) == 1 {
		if abs(move.To.Y-move.From.Y) == 2 {
			ep := Position{move.From.X, (move.From.Y + move.To.Y) / 2}
			next.EnPassant = &ep
		}
		if move.To.Y == 0 || move.To.Y == 7 {
			next.Board[move.To.Y][move.To.X] = promotedPiece(color, move.Promotion)
		}
	}

	updateCastlingRights(&next, piece, move.From, target, move.To)
	if abs(piece) == 1 || capture {
		next.Halfmove = 0
	} else {
		next.Halfmove++
	}
	next.Turn = opposite(color)
	next.Ply++
	next.Last = &MoveData{From: move.From, To: move.To, Promotion: move.Promotion}
	next.Winner = ""
	next.DrawReason = ""
	next.Status = game.StatusPlaying
	next.Legal = nil
	return next
}

func updateCastlingRights(state *State, piece int, from Position, captured int, to Position) {
	if piece == WhiteKing {
		state.Castling.WhiteKingSide, state.Castling.WhiteQueenSide = false, false
	}
	if piece == BlackKing {
		state.Castling.BlackKingSide, state.Castling.BlackQueenSide = false, false
	}
	if piece == WhiteRook {
		if from == (Position{0, 7}) { state.Castling.WhiteQueenSide = false }
		if from == (Position{7, 7}) { state.Castling.WhiteKingSide = false }
	}
	if piece == BlackRook {
		if from == (Position{0, 0}) { state.Castling.BlackQueenSide = false }
		if from == (Position{7, 0}) { state.Castling.BlackKingSide = false }
	}
	if captured == WhiteRook {
		if to == (Position{0, 7}) { state.Castling.WhiteQueenSide = false }
		if to == (Position{7, 7}) { state.Castling.WhiteKingSide = false }
	}
	if captured == BlackRook {
		if to == (Position{0, 0}) { state.Castling.BlackQueenSide = false }
		if to == (Position{7, 0}) { state.Castling.BlackKingSide = false }
	}
}

func promotedPiece(color Color, promotion string) int {
	piece := WhiteQueen
	switch promotion {
	case "r": piece = WhiteRook
	case "b": piece = WhiteBishop
	case "n": piece = WhiteKnight
	}
	if color == Black { return -piece }
	return piece
}

func inCheck(state State, color Color) bool {
	king := WhiteKing
	if color == Black { king = BlackKing }
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			if state.Board[y][x] == king {
				return isSquareAttacked(state, x, y, opposite(color))
			}
		}
	}
	return true
}

func isSquareAttacked(state State, x, y int, attacker Color) bool {
	pawn := WhitePawn
	pawnDir := 1
	if attacker == Black { pawn = BlackPawn; pawnDir = -1 }
	for _, dx := range []int{-1, 1} {
		px, py := x+dx, y+pawnDir
		if inBounds(px, py) && state.Board[py][px] == pawn { return true }
	}
	knight := WhiteKnight
	if attacker == Black { knight = BlackKnight }
	for _, d := range [][2]int{{1,2},{2,1},{-1,2},{-2,1},{1,-2},{2,-1},{-1,-2},{-2,-1}} {
		nx, ny := x+d[0], y+d[1]
		if inBounds(nx, ny) && state.Board[ny][nx] == knight { return true }
	}
	king := WhiteKing
	if attacker == Black { king = BlackKing }
	for dy := -1; dy <= 1; dy++ {
		for dx := -1; dx <= 1; dx++ {
			if dx == 0 && dy == 0 { continue }
			nx, ny := x+dx, y+dy
			if inBounds(nx, ny) && state.Board[ny][nx] == king { return true }
		}
	}
	for _, line := range []struct{ dirs [][2]int; kinds [2]int }{
		{[][2]int{{1,0},{-1,0},{0,1},{0,-1}}, [2]int{4,5}},
		{[][2]int{{1,1},{1,-1},{-1,1},{-1,-1}}, [2]int{3,5}},
	} {
		for _, d := range line.dirs {
			for nx, ny := x+d[0], y+d[1]; inBounds(nx, ny); nx, ny = nx+d[0], ny+d[1] {
				piece := state.Board[ny][nx]
				if piece == Empty { continue }
				if colorOf(piece) == attacker && (abs(piece) == line.kinds[0] || abs(piece) == line.kinds[1]) { return true }
				break
			}
		}
	}
	return false
}

func insufficientMaterial(state State) bool {
	type minor struct{ piece, x, y int }
	minors := make([]minor, 0, 4)
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			piece := state.Board[y][x]
			if piece == Empty || abs(piece) == 6 { continue }
			if abs(piece) == 1 || abs(piece) == 4 || abs(piece) == 5 { return false }
			minors = append(minors, minor{piece, x, y})
		}
	}
	if len(minors) == 0 { return true }
	if len(minors) == 1 { return abs(minors[0].piece) == 2 || abs(minors[0].piece) == 3 }
	if len(minors) == 2 && abs(minors[0].piece) == 3 && abs(minors[1].piece) == 3 && colorOf(minors[0].piece) != colorOf(minors[1].piece) {
		return (minors[0].x+minors[0].y)%2 == (minors[1].x+minors[1].y)%2
	}
	return false
}

func positionKey(state State) string {
	var b strings.Builder
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			b.WriteString(strconv.Itoa(state.Board[y][x])); b.WriteByte(',')
		}
	}
	b.WriteString(string(state.Turn))
	if state.Castling.WhiteKingSide { b.WriteByte('K') }
	if state.Castling.WhiteQueenSide { b.WriteByte('Q') }
	if state.Castling.BlackKingSide { b.WriteByte('k') }
	if state.Castling.BlackQueenSide { b.WriteByte('q') }
	if state.EnPassant != nil {
		b.WriteByte('e'); b.WriteByte(byte('0' + state.EnPassant.X)); b.WriteByte(byte('0' + state.EnPassant.Y))
	}
	return b.String()
}

func opposite(color Color) Color { if color == White { return Black }; return White }
func colorOf(piece int) Color { if piece > 0 { return White }; if piece < 0 { return Black }; return "" }
func abs(v int) int { if v < 0 { return -v }; return v }
func inBounds(x, y int) bool { return x >= 0 && x < 8 && y >= 0 && y < 8 }
