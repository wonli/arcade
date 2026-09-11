package room

import (
	"errors"
	"sync"
	"time"

	"github.com/wonli/arcade/game"
)

type Player struct {
	ID       game.PlayerID `json:"id"`
	Name     string        `json:"name"`
	JoinedAt time.Time     `json:"joinedAt"`
}

type Room struct {
	mu sync.RWMutex

	ID         string       `json:"id"`
	GameName   string       `json:"game"`
	Players    []Player     `json:"players"`
	CreatedAt  time.Time    `json:"createdAt"`
	game       game.Game
}

func New(id, gameName string) *Room {
	return &Room{
		ID:        id,
		GameName:  gameName,
		CreatedAt: time.Now(),
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
	if len(r.Players) >= 2 {
		return errors.New("room is full")
	}
	player.JoinedAt = time.Now()
	r.Players = append(r.Players, player)
	return nil
}

func (r *Room) Ready(g game.Game) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.game = g
}

func (r *Room) Game() game.Game {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.game
}

func (r *Room) Snapshot() map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var state any
	if r.game != nil {
		state = r.game.State()
	}
	players := append([]Player(nil), r.Players...)
	return map[string]any{
		"id":        r.ID,
		"game":      r.GameName,
		"players":   players,
		"createdAt": r.CreatedAt,
		"state":     state,
	}
}
