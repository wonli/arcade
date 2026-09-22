package arcade

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/room"
)

type Service struct {
	rooms         *room.Manager
	sessionStates *SessionStateStore

	snakeMu     sync.Mutex
	snakes      map[string]*snakeRuntime
	snakeSpeeds map[string]int

	drawMu   sync.Mutex
	draws    map[string]*drawGuessRuntime
	drawTick time.Duration
}

func NewService() *Service {
	return &Service{
		rooms:         room.NewManager(),
		sessionStates: NewSessionStateStore(),
		snakes:        make(map[string]*snakeRuntime),
		snakeSpeeds:   make(map[string]int),
		draws:         make(map[string]*drawGuessRuntime),
		drawTick:      250 * time.Millisecond,
	}
}

func (s *Service) Create(gameName string, bounds ...int) (*room.Room, error) {
	minPlayers, maxPlayers, err := roomBounds(bounds)
	if err != nil {
		return nil, err
	}
	if minPlayers < 1 || maxPlayers < minPlayers || maxPlayers > 8 {
		return nil, errors.New("invalid player bounds")
	}
	spec, ok := lookupGameSpec(gameName)
	if !ok {
		return nil, fmt.Errorf("unsupported game: %s", gameName)
	}
	if err := spec.validateBounds(minPlayers, maxPlayers); err != nil {
		return nil, err
	}
	return s.rooms.Create(gameName, minPlayers, maxPlayers)
}

func roomBounds(bounds []int) (int, int, error) {
	switch len(bounds) {
	case 1:
		return bounds[0], bounds[0], nil
	case 2:
		return bounds[0], bounds[1], nil
	default:
		return 0, 0, errors.New("player bounds required")
	}
}

func (s *Service) Get(roomID string) (*room.Room, bool) { return s.rooms.Get(roomID) }

// DungeonPeer validates that a player belongs to a started Dungeon room and
// returns whether that player owns the room host role. The server never owns
// Dungeon gameplay state; it only authenticates relay participants and the
// room host for authoritative fact publication.
func (s *Service) DungeonPeer(roomID string, playerID game.PlayerID) (isHost bool, ok bool) {
	r, exists := s.rooms.Get(roomID)
	if !exists || r.GameName != "dungeon" || !r.Started() || !r.HasPlayer(playerID) {
		return false, false
	}
	return r.HostID == playerID, true
}

func (s *Service) Join(roomID string, playerID game.PlayerID, name string) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if err := r.Join(room.Player{ID: playerID, Name: name}); err != nil {
		return err
	}
	return s.ready(r)
}

func (s *Service) Rematch(roomID string, playerID game.PlayerID) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if !r.HasPlayer(playerID) {
		return errors.New("player is not in room")
	}
	g := r.Game()
	if g == nil || g.Status() != game.StatusFinished {
		return errors.New("game is not finished")
	}
	g.Reset()
	r.SetStatus(room.StatusPlaying)
	return s.botMove(r)
}

func (s *Service) Move(roomID string, playerID game.PlayerID, payload json.RawMessage) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if err := r.Move(playerID, payload); err != nil {
		return err
	}
	return s.botMove(r)
}

func (s *Service) ready(r *room.Room) error {
	spec, ok := lookupGameSpec(r.GameName)
	if !ok {
		return fmt.Errorf("unsupported game: %s", r.GameName)
	}
	return spec.onJoin(r)
}
