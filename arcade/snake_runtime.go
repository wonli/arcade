package arcade

import (
	"errors"
	"math/rand/v2"
	"time"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/snake"
	"github.com/wonli/arcade/room"
)

type SnakePublisher func(roomID string, state snake.State)

type snakeRuntime struct {
	game    *snake.Game
	stop    chan struct{}
	publish SnakePublisher
}

func (s *Service) StartSnake(roomID string, playerID game.PlayerID, publish SnakePublisher) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "snake" { return errors.New("room is not snake") }
	if r.HostID != playerID { return errors.New("only host can start snake") }
	if r.Status != room.StatusWaiting { return errors.New("snake room is not waiting") }
	players := r.Players
	if len(players) < r.MinPlayers || len(players) > r.MaxPlayers { return errors.New("invalid snake player count") }
	return s.startSnakeRuntime(r, players, publish)
}

func (s *Service) SnakeState(roomID string, playerID game.PlayerID) (snake.State, error) {
	r, ok := s.rooms.Get(roomID)
	if !ok { return snake.State{}, errors.New("room not found") }
	if r.GameName != "snake" { return snake.State{}, errors.New("room is not snake") }
	if !r.HasPlayer(playerID) { return snake.State{}, errors.New("player is not in room") }
	s.snakeMu.Lock()
	runtime := s.snakes[roomID]
	s.snakeMu.Unlock()
	if runtime == nil { return snake.State{}, errors.New("snake game is not running") }
	return runtime.game.State(), nil
}

func (s *Service) SnakeInput(roomID string, playerID game.PlayerID, direction snake.Direction) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if !r.HasPlayer(playerID) { return errors.New("player is not in room") }
	s.snakeMu.Lock()
	runtime := s.snakes[roomID]
	s.snakeMu.Unlock()
	if runtime == nil { return errors.New("snake game is not running") }
	return runtime.game.Input(playerID, direction)
}

func (s *Service) RestartSnake(roomID string, playerID game.PlayerID, publish SnakePublisher) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "snake" { return errors.New("room is not snake") }
	if r.HostID != playerID { return errors.New("only host can restart snake") }
	if r.Status != room.StatusFinished { return errors.New("snake game is not finished") }
	return s.startSnakeRuntime(r, r.Players, publish)
}

func (s *Service) startSnakeRuntime(r *room.Room, players []room.Player, publish SnakePublisher) error {
	s.snakeMu.Lock()
	if existing := s.snakes[r.ID]; existing != nil { close(existing.stop); delete(s.snakes, r.ID) }
	enginePlayers := make([]snake.Player, 0, len(players))
	for _, player := range players { enginePlayers = append(enginePlayers, snake.Player{ID: player.ID, Name: player.Name}) }
	runtime := &snakeRuntime{
		game: snake.New(enginePlayers, func(n int) int { if n <= 1 { return 0 }; return rand.IntN(n) }),
		stop: make(chan struct{}),
		publish: publish,
	}
	s.snakes[r.ID] = runtime
	s.snakeMu.Unlock()

	r.SetStatus(room.StatusPlaying)
	go s.runSnake(r, runtime)
	return nil
}

func (s *Service) runSnake(r *room.Room, runtime *snakeRuntime) {
	ticker := time.NewTicker(s.snakeTick)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			state := runtime.game.Tick()
			if runtime.publish != nil { runtime.publish(r.ID, state) }
			if state.Status == game.StatusFinished {
				r.SetStatus(room.StatusFinished)
				s.snakeMu.Lock()
				if s.snakes[r.ID] == runtime { delete(s.snakes, r.ID) }
				s.snakeMu.Unlock()
				return
			}
		case <-runtime.stop:
			return
		}
	}
}
