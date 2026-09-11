package game

import "encoding/json"

type Status string

const (
	StatusWaiting  Status = "waiting"
	StatusPlaying  Status = "playing"
	StatusFinished Status = "finished"
)

type PlayerID string

type Move struct {
	Player PlayerID        `json:"player"`
	Data   json.RawMessage `json:"data"`
}

// Game is deliberately transport-agnostic. A room owns a Game; AQI owns how
// commands arrive and how resulting state is delivered to players/spectators.
type Game interface {
	Name() string
	Status() Status
	Move(Move) error
	State() any
	Reset()
}
