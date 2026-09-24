package arcade

import (
	"errors"
	"time"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/tank"
	"github.com/wonli/arcade/room"
)

type TankPublisher func(roomID string, state tank.State)

type tankRuntime struct {
	game    *tank.Game
	stop    chan struct{}
	publish TankPublisher
	tick    time.Duration
}

func (s *Service) StartTank(roomID string, playerID game.PlayerID, publish TankPublisher) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "tank" { return errors.New("room is not tank") }
	if r.HostID != playerID { return errors.New("only host can start tank") }
	if r.Status != room.StatusWaiting { return errors.New("tank room is not waiting") }
	if len(r.Players) != 2 { return errors.New("tank requires two players") }
	return s.startTankRuntime(r, publish)
}

func (s *Service) TankState(roomID string, playerID game.PlayerID) (tank.State, error) {
	r, ok := s.rooms.Get(roomID)
	if !ok { return tank.State{}, errors.New("room not found") }
	if r.GameName != "tank" { return tank.State{}, errors.New("room is not tank") }
	if !r.HasPlayer(playerID) { return tank.State{}, errors.New("player is not in room") }
	s.tankMu.Lock()
	runtime := s.tanks[roomID]
	s.tankMu.Unlock()
	if runtime == nil { return tank.State{}, errors.New("tank game is not running") }
	return runtime.game.State(), nil
}

func (s *Service) TankInput(roomID string, playerID game.PlayerID, input tank.Input) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "tank" { return errors.New("room is not tank") }
	if !r.HasPlayer(playerID) { return errors.New("player is not in room") }
	s.tankMu.Lock()
	runtime := s.tanks[roomID]
	s.tankMu.Unlock()
	if runtime == nil { return errors.New("tank game is not running") }
	return runtime.game.Input(playerID, input)
}

func (s *Service) RestartTank(roomID string, playerID game.PlayerID, publish TankPublisher) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "tank" { return errors.New("room is not tank") }
	if r.HostID != playerID { return errors.New("only host can restart tank") }
	if r.Status != room.StatusFinished { return errors.New("tank game is not finished") }
	if len(r.Players) != 2 { return errors.New("tank requires two players") }
	return s.startTankRuntime(r, publish)
}

func (s *Service) startTankRuntime(r *room.Room, publish TankPublisher) error {
	s.stopTankRuntime(r.ID)
	players := make([]tank.Player, 0, len(r.Players))
	for _, player := range r.Players {
		players = append(players, tank.Player{ID: player.ID, Name: player.Name})
	}
	runtime := &tankRuntime{
		game:    tank.New(players),
		stop:    make(chan struct{}),
		publish: publish,
		tick:    time.Duration(tank.TickSeconds * float64(time.Second)),
	}
	s.tankMu.Lock()
	s.tanks[r.ID] = runtime
	s.tankMu.Unlock()

	r.SetRuntimeState(runtime.game.State())
	r.SetStatus(room.StatusPlaying)
	go s.runTank(r, runtime)
	return nil
}

func (s *Service) stopTankRuntime(roomID string) {
	s.tankMu.Lock()
	runtime := s.tanks[roomID]
	if runtime != nil {
		delete(s.tanks, roomID)
		close(runtime.stop)
	}
	s.tankMu.Unlock()
}

func (s *Service) runTank(r *room.Room, runtime *tankRuntime) {
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
				s.tankMu.Lock()
				if s.tanks[r.ID] == runtime { delete(s.tanks, r.ID) }
				s.tankMu.Unlock()
				return
			}
		case <-runtime.stop:
			return
		}
	}
}
