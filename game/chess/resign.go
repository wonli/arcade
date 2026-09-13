package chess

import (
	"errors"

	"github.com/wonli/arcade/game"
)

func (g *Game) Resign(player game.PlayerID) error {
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}
	color, ok := g.players[player]
	if !ok {
		return errors.New("player is not in this game")
	}
	g.state.Status = game.StatusFinished
	g.state.Winner = opposite(color)
	g.state.DrawReason = "resignation"
	g.state.Check = false
	g.state.Legal = nil
	return nil
}
