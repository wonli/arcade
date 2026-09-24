package xiangqi

import "github.com/wonli/arcade/game"

// ForfeitTurn finishes the game only if the clock still belongs to the
// expected turn. The turn + ply guard makes an expired timer harmless after a
// legal move has already advanced the authoritative state.
func (g *Game) ForfeitTurn(expectedTurn Color, expectedPly int) bool {
	if g.state.Status != game.StatusPlaying || g.state.Turn != expectedTurn || g.state.Ply != expectedPly {
		return false
	}

	g.state.Status = game.StatusFinished
	g.state.Winner = opposite(expectedTurn)
	g.state.DrawReason = "timeout"
	g.state.Check = false
	g.state.Legal = nil
	return true
}
