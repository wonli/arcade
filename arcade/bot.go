package arcade

import (
	"encoding/json"
	"errors"

	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/chess"
	"github.com/wonli/arcade/game/gomoku"
	"github.com/wonli/arcade/game/policethief"
	"github.com/wonli/arcade/game/xiangqi"
	"github.com/wonli/arcade/room"
)

func (s *Service) AddBot(roomID string, playerID game.PlayerID, difficulty ...string) error {
	r, ok := s.rooms.Get(roomID)
	if !ok {
		return errors.New("room not found")
	}
	if r.GameName != "gomoku" && r.GameName != "chess" && r.GameName != "policethief" && r.GameName != "xiangqi" {
		return errors.New("bot is only available for gomoku, chess, policethief, and xiangqi")
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
	_, err := s.botMove(r)
	return err
}

func (s *Service) botMove(r *room.Room) (bool, error) {
	snapshot := r.Snapshot()
	players, ok := snapshot["players"].([]room.Player)
	if !ok || len(players) != 2 || !players[1].Bot || snapshot["status"] != room.StatusPlaying {
		return false, nil
	}

	switch state := snapshot["state"].(type) {
	case gomoku.State:
		if state.Turn != gomoku.White {
			return false, nil
		}
		pos, ok := gomoku.ChooseBotMove(state, gomoku.White)
		if !ok {
			return false, nil
		}
		payload, err := json.Marshal(pos)
		if err != nil {
			return false, err
		}
		return true, r.Move(players[1].ID, payload)
	case chess.State:
		if state.Turn != chess.Black {
			return false, nil
		}
		move, ok := chess.ChooseBotMove(state, chess.Black, chess.NormalizeDifficulty(players[1].BotDifficulty))
		if !ok {
			return false, nil
		}
		payload, err := json.Marshal(move)
		if err != nil {
			return false, err
		}
		return true, r.Move(players[1].ID, payload)
	case policethief.State:
		role := state.RoleOf(players[1].ID)
		if role == "" || state.Turn != role {
			return false, nil
		}
		to, ok := policethief.ChooseBotMove(state, role)
		if !ok {
			return false, nil
		}
		payload, err := json.Marshal(policethief.Move{To: to})
		if err != nil {
			return false, err
		}
		return true, r.Move(players[1].ID, payload)
	case xiangqi.State:
		if state.Turn != xiangqi.Black {
			return false, nil
		}
		move, ok := xiangqi.ChooseBotMove(state, xiangqi.Black)
		if !ok {
			return false, nil
		}
		payload, err := json.Marshal(move)
		if err != nil {
			return false, err
		}
		return true, r.Move(players[1].ID, payload)
	default:
		return false, nil
	}
}
