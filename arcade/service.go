package arcade

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/gomoku"
	"github.com/wonli/arcade/room"
)

type Service struct {
	rooms *room.Manager
}

func NewService() *Service {
	return &Service{rooms: room.NewManager()}
}

func (s *Service) Create(gameName string) (*room.Room, error) {
	if gameName != "gomoku" {
		return nil, fmt.Errorf("unsupported game: %s", gameName)
	}
	return s.rooms.Create(gameName)
}

func (s *Service) Get(roomID string) (*room.Room, bool) {
	return s.rooms.Get(roomID)
}

func (s *Service) Join(roomID string, playerID game.PlayerID, name string) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if err := r.Join(room.Player{ID: playerID, Name: name}); err != nil {
		return err
	}

	ids := r.PlayerIDs()
	if len(ids) == 2 && r.Game() == nil {
		switch r.GameName {
		case "gomoku":
			r.Ready(gomoku.New(ids[0], ids[1]))
		default:
			return fmt.Errorf("unsupported game: %s", r.GameName)
		}
	}
	return nil
}

func (s *Service) Move(roomID string, playerID game.PlayerID, payload json.RawMessage) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	return r.Move(playerID, payload)
}
