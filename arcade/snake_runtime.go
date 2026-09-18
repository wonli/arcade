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
	speed   int
	tick    time.Duration
}

func snakeTickForSpeed(speed int) (time.Duration, error) {
	switch speed {
	case 1:
		return 200 * time.Millisecond, nil
	case 2:
		return 160 * time.Millisecond, nil
	case 3:
		return 130 * time.Millisecond, nil
	case 4:
		return 100 * time.Millisecond, nil
	case 5:
		return 80 * time.Millisecond, nil
	default:
		return 0, errors.New("snake speed must be between 1 and 5")
	}
}

func (s *Service) StartSnake(roomID string, playerID game.PlayerID, speed int, publish SnakePublisher) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "snake" { return errors.New("room is not snake") }
	if r.HostID != playerID { return errors.New("only host can start snake") }
	if r.Status != room.StatusWaiting { return errors.New("snake room is not waiting") }
	players := r.Players
	if len(players) < r.MinPlayers || len(players) > r.MaxPlayers { return errors.New("invalid snake player count") }
	tick, err := snakeTickForSpeed(speed)
	if err != nil { return err }
	return s.startSnakeRuntime(r, players, speed, tick, publish)
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

	s.snakeMu.Lock()
	speed := s.snakeSpeeds[roomID]
	s.snakeMu.Unlock()
	if speed == 0 { speed = 2 }
	tick, err := snakeTickForSpeed(speed)
	if err != nil { return err }
	return s.startSnakeRuntime(r, r.Players, speed, tick, publish)
}

func (s *Service) startSnakeRuntime(r *room.Room, players []room.Player, speed int, tick time.Duration, publish SnakePublisher) error {
	s.snakeMu.Lock()
	if existing := s.snakes[r.ID]; existing != nil { close(existing.stop); delete(s.snakes, r.ID) }
	enginePlayers := make([]snake.Player, 0, len(players))
	for _, player := range players { enginePlayers = append(enginePlayers, snake.Player{ID: player.ID, Name: player.Name}) }
	runtime := &snakeRuntime{
		game: snake.New(enginePlayers, func(n int) int { if n <= 1 { return 0 }; return rand.IntN(n) }),
		stop: make(chan struct{}),
		publish: publish,
		speed: speed,
		tick: tick,
	}
	s.snakes[r.ID] = runtime
	s.snakeSpeeds[r.ID] = speed
	s.snakeMu.Unlock()

	r.SetRuntimeState(runtime.game.State())
	r.SetStatus(room.StatusPlaying)
	go s.runSnake(r, runtime)
	return nil
}

func (s *Service) runSnake(r *room.Room, runtime *snakeRuntime) {
	ticker := time.NewTicker(runtime.tick)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			state := runtime.game.Tick()
			r.SetRuntimeState(state)
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
