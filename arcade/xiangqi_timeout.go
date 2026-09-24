package arcade

import (
	"errors"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/xiangqi"
)

// ForfeitXiangqiTurn applies a server-authoritative timeout only when the
// expected turn is still current. A stale timer therefore cannot end a game
// after a player has already moved.
func (s *Service) ForfeitXiangqiTurn(roomID string, expectedTurn xiangqi.Color, expectedPly int) (bool, error) {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return false, errors.New("room not found")
	}
	if r.GameName != "xiangqi" {
		return false, errors.New("room is not xiangqi")
	}

	forfeited := false
	err := r.UpdateGame(func(base game.Game) error {
		g, ok := base.(*xiangqi.Game)
		if !ok {
			return errors.New("xiangqi game has not started")
		}
		forfeited = g.ForfeitTurn(expectedTurn, expectedPly)
		return nil
	})
	return forfeited, err
}
