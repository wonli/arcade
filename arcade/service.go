package arcade

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/gomoku"
	"github.com/wonli/arcade/room"
)

type Service struct { rooms *room.Manager }
func NewService() *Service { return &Service{rooms: room.NewManager()} }

func (s *Service) Create(gameName string, maxPlayers int) (*room.Room, error) {
	if maxPlayers != 1 && maxPlayers != 2 { return nil, errors.New("players must be 1 or 2") }
	if gameName == "gomoku" && maxPlayers == 1 { return nil, errors.New("solo gomoku is not supported") }
	switch gameName {
	case "gomoku", "tetris": return s.rooms.Create(gameName, maxPlayers)
	default: return nil, fmt.Errorf("unsupported game: %s", gameName)
	}
}
func (s *Service) Get(roomID string) (*room.Room, bool) { return s.rooms.Get(roomID) }
func (s *Service) Join(roomID string, playerID game.PlayerID, name string) error {
	r, ok := s.rooms.Get(roomID); if !ok { return errors.New("room not found") }
	if err := r.Join(room.Player{ID: playerID, Name: name}); err != nil { return err }
	return s.ready(r)
}
func (s *Service) AddBot(roomID string, playerID game.PlayerID) error {
	r, ok := s.rooms.Get(roomID); if !ok { return errors.New("room not found") }
	if r.GameName != "gomoku" { return errors.New("bot is only available for gomoku") }
	if len(r.Players) != 1 || r.Players[0].ID != playerID { return errors.New("bot can only be added by the first player to an empty seat") }
	botID := game.PlayerID("bot:" + r.ID)
	if err := r.Join(room.Player{ID: botID, Name: "AQI BOT", Bot: true}); err != nil { return err }
	return s.ready(r)
}
func (s *Service) Rematch(roomID string, playerID game.PlayerID) error {
	r, ok := s.rooms.Get(roomID); if !ok { return errors.New("room not found") }
	if !r.HasPlayer(playerID) { return errors.New("player is not in room") }
	g := r.Game(); if g == nil || g.Status() != game.StatusFinished { return errors.New("game is not finished") }
	g.Reset(); return nil
}
func (s *Service) Move(roomID string, playerID game.PlayerID, payload json.RawMessage) error {
	r, ok := s.rooms.Get(roomID); if !ok { return errors.New("room not found") }
	if err := r.Move(playerID, payload); err != nil { return err }
	return s.botMove(r)
}
func (s *Service) ready(r *room.Room) error {
	ids := r.PlayerIDs()
	if len(ids) != r.MaxPlayers || r.Game() != nil { return nil }
	switch r.GameName {
	case "gomoku":
		if len(ids) != 2 { return errors.New("gomoku requires two players") }
		r.Ready(gomoku.New(ids[0], ids[1]))
	case "tetris": return nil
	default: return fmt.Errorf("unsupported game: %s", r.GameName)
	}
	return nil
}
func (s *Service) botMove(r *room.Room) error {
	if len(r.Players) != 2 || !r.Players[1].Bot || r.Game() == nil || r.Game().Status() != game.StatusPlaying { return nil }
	state, ok := r.Game().State().(gomoku.State); if !ok || state.Turn != gomoku.White { return nil }
	pos, ok := gomoku.ChooseBotMove(state, gomoku.White); if !ok { return nil }
	payload, err := json.Marshal(pos); if err != nil { return err }
	return r.Move(r.Players[1].ID, payload)
}
