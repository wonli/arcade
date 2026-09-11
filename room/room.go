package room

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/wonli/arcade/game"
)

type Player struct {
	ID       game.PlayerID `json:"id"`
	Name     string        `json:"name"`
	Bot      bool          `json:"bot,omitempty"`
	JoinedAt time.Time     `json:"joinedAt"`
}

type Room struct {
	mu sync.RWMutex

	ID         string    `json:"id"`
	GameName   string    `json:"game"`
	MaxPlayers int       `json:"maxPlayers"`
	Players    []Player  `json:"players"`
	CreatedAt  time.Time `json:"createdAt"`
	game       game.Game
}

func New(id, gameName string, maxPlayers int) *Room {
	return &Room{ID: id, GameName: gameName, MaxPlayers: maxPlayers, CreatedAt: time.Now()}
}

func (r *Room) Join(player Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, p := range r.Players { if p.ID == player.ID { return nil } }
	if len(r.Players) >= r.MaxPlayers { return errors.New("room is full") }
	player.JoinedAt = time.Now()
	r.Players = append(r.Players, player)
	return nil
}

func (r *Room) PlayerIDs() []game.PlayerID {
	r.mu.RLock(); defer r.mu.RUnlock()
	ids := make([]game.PlayerID, 0, len(r.Players))
	for _, player := range r.Players { ids = append(ids, player.ID) }
	return ids
}

func (r *Room) HasPlayer(id game.PlayerID) bool {
	r.mu.RLock(); defer r.mu.RUnlock()
	for _, player := range r.Players { if player.ID == id { return true } }
	return false
}

func (r *Room) Started() bool {
	r.mu.RLock(); defer r.mu.RUnlock()
	return len(r.Players) >= r.MaxPlayers
}

func (r *Room) Ready(g game.Game) { r.mu.Lock(); defer r.mu.Unlock(); r.game = g }
func (r *Room) Game() game.Game { r.mu.RLock(); defer r.mu.RUnlock(); return r.game }

func (r *Room) Move(player game.PlayerID, data json.RawMessage) error {
	r.mu.Lock(); defer r.mu.Unlock()
	if r.game == nil { return errors.New("game has not started") }
	for _, p := range r.Players { if p.ID == player { return r.game.Move(game.Move{Player: player, Data: data}) } }
	return errors.New("player is not in room")
}

func (r *Room) Snapshot() map[string]any {
	r.mu.RLock(); defer r.mu.RUnlock()
	var state any
	if r.game != nil { state = r.game.State() }
	players := append([]Player(nil), r.Players...)
	return map[string]any{
		"id": r.ID, "game": r.GameName, "maxPlayers": r.MaxPlayers,
		"players": players, "createdAt": r.CreatedAt, "state": state,
	}
}
