package arcade

import (
	"errors"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/chess"
	"github.com/wonli/arcade/game/xiangqi"
)

func (s *Service) Resign(roomID string, playerID game.PlayerID) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if !r.HasPlayer(playerID) {
		return errors.New("player is not in room")
	}

	return r.UpdateGame(func(base game.Game) error {
		switch g := base.(type) {
		case *chess.Game:
			return g.Resign(playerID)
		case *xiangqi.Game:
			return g.Resign(playerID)
		default:
			return errors.New("resign is not available for this game")
		}
	})
}
