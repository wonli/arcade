package arcade

import (
	"errors"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/chess"
	"github.com/wonli/arcade/room"
)

func (s *Service) Resign(roomID string, playerID game.PlayerID) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if r.GameName != "chess" {
		return errors.New("resign is only available for chess")
	}
	if !r.HasPlayer(playerID) {
		return errors.New("player is not in room")
	}
	g, ok := r.Game().(*chess.Game)
	if !ok || g == nil {
		return errors.New("chess game has not started")
	}
	if err := g.Resign(playerID); err != nil {
		return err
	}
	r.SetStatus(room.StatusFinished)
	return nil
}
