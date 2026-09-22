package arcade

import (
	"encoding/json"
	"errors"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/chess"
	"github.com/wonli/arcade/game/gomoku"
	"github.com/wonli/arcade/game/policethief"
	"github.com/wonli/arcade/room"
)

func (s *Service) AddBot(roomID string, playerID game.PlayerID, difficulty ...string) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if r.GameName != "gomoku" && r.GameName != "chess" && r.GameName != "policethief" {
		return errors.New("bot is only available for gomoku, chess, and policethief")
	}
	if len(r.Players) != 1 || r.Players[0].ID != playerID {
		return errors.New("bot can only be added by the first player to an empty seat")
	}
	level := ""
	if r.GameName == "chess" {
		if len(difficulty) > 0 {
			level = string(chess.NormalizeDifficulty(difficulty[0]))
		} else {
			level = string(chess.Medium)
		}
	}
	botID := game.PlayerID("bot:" + r.ID)
	if err := r.Join(room.Player{ID: botID, Name: "AQI BOT", Bot: true, BotDifficulty: level}); err != nil {
		return err
	}
	if err := s.ready(r); err != nil {
		return err
	}
	return s.botMove(r)
}

func (s *Service) botMove(r *room.Room) error {
	if len(r.Players) != 2 || !r.Players[1].Bot || r.Game() == nil || r.Game().Status() != game.StatusPlaying {
		return nil
	}
	switch state := r.Game().State().(type) {
	case gomoku.State:
		if state.Turn != gomoku.White {
			return nil
		}
		pos, ok := gomoku.ChooseBotMove(state, gomoku.White)
		if !ok {
			return nil
		}
		payload, err := json.Marshal(pos)
		if err != nil {
			return err
		}
		return r.Move(r.Players[1].ID, payload)
	case chess.State:
		if state.Turn != chess.Black {
			return nil
		}
		move, ok := chess.ChooseBotMove(state, chess.Black, chess.NormalizeDifficulty(r.Players[1].BotDifficulty))
		if !ok {
			return nil
		}
		payload, err := json.Marshal(move)
		if err != nil {
			return err
		}
		return r.Move(r.Players[1].ID, payload)
	case policethief.State:
		role := state.RoleOf(r.Players[1].ID)
		if role == "" || state.Turn != role {
			return nil
		}
		to, ok := policethief.ChooseBotMove(state, role)
		if !ok {
			return nil
		}
		payload, err := json.Marshal(policethief.Move{To: to})
		if err != nil {
			return err
		}
		return r.Move(r.Players[1].ID, payload)
	default:
		return nil
	}
}
