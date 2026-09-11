package arcade

import (
	"errors"
	"strings"
	"time"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/drawguess"
	"github.com/wonli/arcade/room"
)

type DrawGuessPublisher func(roomID string, event map[string]any)

type drawGuessRuntime struct {
	game    *drawguess.Game
	stop    chan struct{}
	publish DrawGuessPublisher
}

var drawGuessWords = []string{
	"giraffe", "rocket", "piano", "banana", "bicycle", "rainbow", "castle", "penguin",
	"camera", "pizza", "dolphin", "airplane", "umbrella", "snowman", "backpack", "football",
	"butterfly", "volcano", "elephant", "helicopter", "hamburger", "lighthouse", "octopus", "kangaroo",
	"computer", "watermelon", "strawberry", "dragon", "robot", "train", "island", "cactus",
}

func (s *Service) StartDrawGuess(roomID string, playerID game.PlayerID, publish DrawGuessPublisher) error {
	r, ok := s.rooms.Get(roomID)
	if !ok { return errors.New("room not found") }
	if r.GameName != "drawguess" { return errors.New("room is not drawguess") }
	if r.HostID != playerID { return errors.New("only host can start draw and guess") }
	if r.Status == room.StatusPlaying { return errors.New("draw and guess is already playing") }
	if len(r.Players) < r.MinPlayers || len(r.Players) > r.MaxPlayers { return errors.New("draw and guess requires 2-8 players") }

	s.drawMu.Lock()
	if existing := s.draws[roomID]; existing != nil {
		close(existing.stop)
		delete(s.draws, roomID)
	}
	players := make([]drawguess.Player, 0, len(r.Players))
	for _, player := range r.Players {
		players = append(players, drawguess.Player{ID: player.ID, Name: player.Name})
	}
	engine := drawguess.New(players, drawGuessWords, time.Now)
	if err := engine.Start(); err != nil {
		s.drawMu.Unlock()
		return err
	}
	runtime := &drawGuessRuntime{game: engine, stop: make(chan struct{}), publish: publish}
	s.draws[roomID] = runtime
	s.drawMu.Unlock()

	r.SetStatus(room.StatusPlaying)
	s.mirrorDrawGuess(r, runtime)
	s.publishDrawGuess(runtime, r.ID, map[string]any{"type": "draw.state", "state": runtime.game.PublicState()})
	go s.runDrawGuess(r, runtime)
	return nil
}

func (s *Service) DrawGuessPrivateState(roomID string, playerID game.PlayerID) (drawguess.PrivateState, error) {
	r, runtime, err := s.drawRuntime(roomID, playerID)
	if err != nil { return drawguess.PrivateState{}, err }
	if r.GameName != "drawguess" { return drawguess.PrivateState{}, errors.New("room is not drawguess") }
	return runtime.game.PrivateState(playerID), nil
}

func (s *Service) DrawGuessStroke(roomID string, playerID game.PlayerID, stroke drawguess.Stroke) error {
	r, runtime, err := s.drawRuntime(roomID, playerID)
	if err != nil { return err }
	if err := runtime.game.Stroke(playerID, stroke); err != nil { return err }
	s.mirrorDrawGuess(r, runtime)
	s.publishDrawGuess(runtime, roomID, map[string]any{"type": "draw.stroke", "playerId": playerID, "stroke": stroke})
	return nil
}

func (s *Service) DrawGuessClear(roomID string, playerID game.PlayerID) error {
	r, runtime, err := s.drawRuntime(roomID, playerID)
	if err != nil { return err }
	if err := runtime.game.Clear(playerID); err != nil { return err }
	s.mirrorDrawGuess(r, runtime)
	s.publishDrawGuess(runtime, roomID, map[string]any{"type": "draw.clear", "playerId": playerID})
	return nil
}

func (s *Service) DrawGuessGuess(roomID string, playerID game.PlayerID, text string) (drawguess.GuessResult, error) {
	r, runtime, err := s.drawRuntime(roomID, playerID)
	if err != nil { return drawguess.GuessResult{}, err }
	result := runtime.game.Guess(playerID, text)
	if result.Error != "" { return result, errors.New(result.Error) }

	s.mirrorDrawGuess(r, runtime)
	if result.Correct {
		s.publishDrawGuess(runtime, roomID, map[string]any{
			"type": "draw.correct", "playerId": result.PlayerID, "playerName": result.PlayerName,
			"score": result.Score, "state": runtime.game.PublicState(),
		})
	} else {
		s.publishDrawGuess(runtime, roomID, map[string]any{
			"type": "draw.chat", "playerId": result.PlayerID, "playerName": result.PlayerName, "text": result.Chat,
		})
	}
	if result.RoundAdvanced {
		s.publishDrawGuess(runtime, roomID, map[string]any{"type": "draw.state", "state": runtime.game.PublicState()})
	}
	if result.Finished {
		r.SetStatus(room.StatusFinished)
		s.mirrorDrawGuess(r, runtime)
	}
	return result, nil
}

func (s *Service) drawRuntime(roomID string, playerID game.PlayerID) (*room.Room, *drawGuessRuntime, error) {
	roomID = strings.ToUpper(strings.TrimSpace(roomID))
	r, ok := s.rooms.Get(roomID)
	if !ok { return nil, nil, errors.New("room not found") }
	if r.GameName != "drawguess" { return nil, nil, errors.New("room is not drawguess") }
	if !r.HasPlayer(playerID) { return nil, nil, errors.New("player is not in room") }
	s.drawMu.Lock()
	runtime := s.draws[roomID]
	s.drawMu.Unlock()
	if runtime == nil { return nil, nil, errors.New("draw and guess is not running") }
	return r, runtime, nil
}

func (s *Service) runDrawGuess(r *room.Room, runtime *drawGuessRuntime) {
	ticker := time.NewTicker(s.drawTick)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if !runtime.game.AdvanceIfExpired() { continue }
			state := runtime.game.PublicState()
			if state.Status == "finished" { r.SetStatus(room.StatusFinished) }
			r.SetRuntimeState(state)
			s.publishDrawGuess(runtime, r.ID, map[string]any{"type": "draw.state", "state": state})
		case <-runtime.stop:
			return
		}
	}
}

func (s *Service) mirrorDrawGuess(r *room.Room, runtime *drawGuessRuntime) {
	r.SetRuntimeState(runtime.game.PublicState())
}

func (s *Service) publishDrawGuess(runtime *drawGuessRuntime, roomID string, event map[string]any) {
	if runtime.publish != nil { runtime.publish(roomID, event) }
}
