package room

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/wonli/arcade/game"
)

type Status string

const (
	StatusWaiting  Status = "waiting"
	StatusPlaying  Status = "playing"
	StatusFinished Status = "finished"
)

type Player struct {
	ID            game.PlayerID `json:"id"`
	Name          string        `json:"name"`
	Bot           bool          `json:"bot,omitempty"`
	BotDifficulty string        `json:"botDifficulty,omitempty"`
	JoinedAt      time.Time     `json:"joinedAt"`
}

type Room struct {
	mu sync.RWMutex

	ID           string        `json:"id"`
	GameName     string        `json:"game"`
	MinPlayers   int           `json:"minPlayers"`
	MaxPlayers   int           `json:"maxPlayers"`
	HostID       game.PlayerID `json:"hostId"`
	Status       Status        `json:"status"`
	Players      []Player      `json:"players"`
	CreatedAt    time.Time     `json:"createdAt"`
	game         game.Game
	runtimeState any
}

func New(id, gameName string, minPlayers, maxPlayers int) *Room {
	return &Room{
		ID:         id,
		GameName:   gameName,
		MinPlayers: minPlayers,
		MaxPlayers: maxPlayers,
		Status:     StatusWaiting,
		CreatedAt:  time.Now(),
	}
}

func (r *Room) Join(player Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, p := range r.Players {
		if p.ID == player.ID {
			return nil
		}
	}
	if r.Status != StatusWaiting {
		return errors.New("room has already started")
	}
	if len(r.Players) >= r.MaxPlayers {
		return errors.New("room is full")
	}
	player.JoinedAt = time.Now()
	if len(r.Players) == 0 {
		r.HostID = player.ID
	}
	r.Players = append(r.Players, player)
	return nil
}

func (r *Room) PlayerIDs() []game.PlayerID {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ids := make([]game.PlayerID, 0, len(r.Players))
	for _, player := range r.Players {
		ids = append(ids, player.ID)
	}
	return ids
}

func (r *Room) HasPlayer(id game.PlayerID) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, player := range r.Players {
		if player.ID == id {
			return true
		}
	}
	return false
}

func (r *Room) Started() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Status != StatusWaiting
}

func (r *Room) SetStatus(status Status) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Status = status
}

func (r *Room) SetRuntimeState(state any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.runtimeState = state
}

func (r *Room) Ready(g game.Game) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.game = g
	r.Status = StatusPlaying
}

func (r *Room) Game() game.Game {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.game
}

// UpdateGame serializes non-move game mutations with moves and snapshots.
// Room status follows the authoritative game status after a successful update.
func (r *Room) UpdateGame(update func(game.Game) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.game == nil {
		return errors.New("game has not started")
	}
	if err := update(r.game); err != nil {
		return err
	}
	r.syncGameStatusLocked()
	return nil
}

func (r *Room) Move(player game.PlayerID, data json.RawMessage) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.game == nil {
		return errors.New("game has not started")
	}
	for _, p := range r.Players {
		if p.ID != player {
			continue
		}
		if err := r.game.Move(game.Move{Player: player, Data: data}); err != nil {
			return err
		}
		r.syncGameStatusLocked()
		return nil
	}
	return errors.New("player is not in room")
}

func (r *Room) syncGameStatusLocked() {
	if r.game == nil {
		return
	}
	if r.game.Status() == game.StatusFinished {
		r.Status = StatusFinished
		return
	}
	if r.Status != StatusWaiting {
		r.Status = StatusPlaying
	}
}

func (r *Room) Snapshot() map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()

	state := r.runtimeState
	if r.game != nil {
		state = r.game.State()
	}
	players := append([]Player(nil), r.Players...)
	return map[string]any{
		"id":         r.ID,
		"game":       r.GameName,
		"minPlayers": r.MinPlayers,
		"maxPlayers": r.MaxPlayers,
		"hostId":     r.HostID,
		"status":     r.Status,
		"players":    players,
		"createdAt":  r.CreatedAt,
		"state":      state,
	}
}
