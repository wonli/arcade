package policethief

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"

	"github.com/wonli/arcade/game"
)

type Role string

const (
	Thief  Role = "thief"
	Police Role = "police"
)

type Setup struct {
	HostRole Role `json:"hostRole"`
}

type Node string

const (
	A Node = "A"
	B Node = "B"
	C Node = "C"
	D Node = "D"
	E Node = "E"
	F Node = "F"
)

var nodes = []Node{A, B, C, D, E, F}

var graph = map[Node][]Node{
	A: {B, C, D},
	B: {A, E},
	C: {A, E, F},
	D: {A, F},
	E: {B, C, F},
	F: {C, D, E},
}

type Move struct {
	To Node `json:"to"`
}

type LastMove struct {
	Role Role `json:"role"`
	From Node `json:"from"`
	To   Node `json:"to"`
}

type State struct {
	Thief        Node          `json:"thief"`
	Police       Node          `json:"police"`
	Turn         Role          `json:"turn"`
	Winner       Role          `json:"winner,omitempty"`
	Status       game.Status   `json:"status"`
	Moves        int           `json:"moves"`
	Last         *LastMove     `json:"last,omitempty"`
	ThiefPlayer  game.PlayerID `json:"thiefPlayer"`
	PolicePlayer game.PlayerID `json:"policePlayer"`
}

func (s State) RoleOf(player game.PlayerID) Role {
	switch player {
	case s.ThiefPlayer:
		return Thief
	case s.PolicePlayer:
		return Police
	default:
		return ""
	}
}

type Game struct {
	state   State
	players map[game.PlayerID]Role
	spawn   func() (Node, Node)
}

func New(thiefPlayer, policePlayer game.PlayerID) *Game {
	return newGame(thiefPlayer, policePlayer, randomDistinctNodes)
}

func newGame(thiefPlayer, policePlayer game.PlayerID, spawn func() (Node, Node)) *Game {
	g := &Game{
		players: map[game.PlayerID]Role{
			thiefPlayer:  Thief,
			policePlayer: Police,
		},
		spawn: spawn,
	}
	g.state.ThiefPlayer = thiefPlayer
	g.state.PolicePlayer = policePlayer
	g.Reset()
	return g
}

func (g *Game) Name() string        { return "policethief" }
func (g *Game) Status() game.Status { return g.state.Status }
func (g *Game) State() any          { return g.state }

func (g *Game) Reset() {
	thief, police := g.spawn()
	if !ValidNode(thief) || !ValidNode(police) || thief == police {
		thief, police = A, F
	}
	g.state = State{
		Thief:        thief,
		Police:       police,
		Turn:         Thief,
		Status:       game.StatusPlaying,
		ThiefPlayer:  g.state.ThiefPlayer,
		PolicePlayer: g.state.PolicePlayer,
	}
}

func (g *Game) Move(m game.Move) error {
	if g.state.Status != game.StatusPlaying {
		return errors.New("game is not playing")
	}
	role, ok := g.players[m.Player]
	if !ok {
		return errors.New("player is not in this game")
	}
	if role != g.state.Turn {
		return errors.New("not your turn")
	}

	var move Move
	if err := json.Unmarshal(m.Data, &move); err != nil {
		return fmt.Errorf("invalid move: %w", err)
	}
	if !ValidNode(move.To) {
		return errors.New("invalid node")
	}

	from := g.state.Thief
	if role == Police {
		from = g.state.Police
	}
	if !Connected(from, move.To) {
		return errors.New("nodes are not connected")
	}
	if role == Thief && move.To == g.state.Police {
		return errors.New("thief cannot move onto police")
	}

	if role == Thief {
		g.state.Thief = move.To
	} else {
		g.state.Police = move.To
	}
	g.state.Moves++
	g.state.Last = &LastMove{Role: role, From: from, To: move.To}

	if role == Police && g.state.Police == g.state.Thief {
		g.state.Winner = Police
		g.state.Status = game.StatusFinished
		return nil
	}
	if role == Thief {
		g.state.Turn = Police
	} else {
		g.state.Turn = Thief
	}
	return nil
}

func ValidNode(node Node) bool {
	_, ok := graph[node]
	return ok
}

func Connected(from, to Node) bool {
	for _, next := range graph[from] {
		if next == to {
			return true
		}
	}
	return false
}

func Connections(node Node) []Node {
	return append([]Node(nil), graph[node]...)
}

func NormalizeRole(value string) Role {
	if Role(value) == Police {
		return Police
	}
	return Thief
}

func Opposite(role Role) Role {
	if role == Police {
		return Thief
	}
	return Police
}

type chaseState struct {
	thief  Node
	police Node
	turn   Role
}

var capturePlies = solveCapturePlies()

func solveCapturePlies() map[chaseState]int {
	plies := make(map[chaseState]int, len(nodes)*len(nodes)*2)
	turns := []Role{Thief, Police}

	for {
		changed := false
		for _, thief := range nodes {
			for _, police := range nodes {
				if thief == police {
					continue
				}
				for _, turn := range turns {
					state := chaseState{thief: thief, police: police, turn: turn}
					if _, known := plies[state]; known {
						continue
					}

					if turn == Police {
						best := -1
						for _, next := range graph[police] {
							if next == thief {
								best = 1
								break
							}
							if value, known := plies[chaseState{thief: thief, police: next, turn: Thief}]; known {
								candidate := value + 1
								if best == -1 || candidate < best {
									best = candidate
								}
							}
						}
						if best != -1 {
							plies[state] = best
							changed = true
						}
						continue
					}

					options := thiefMoves(thief, police)
					if len(options) == 0 {
						plies[state] = 0
						changed = true
						continue
					}
					worst := 0
					allKnown := true
					for _, next := range options {
						value, known := plies[chaseState{thief: next, police: police, turn: Police}]
						if !known {
							allKnown = false
							break
						}
						if value+1 > worst {
							worst = value + 1
						}
					}
					if allKnown {
						plies[state] = worst
						changed = true
					}
				}
			}
		}
		if !changed {
			return plies
		}
	}
}

func thiefMoves(thief, police Node) []Node {
	options := Connections(thief)
	legal := options[:0]
	for _, option := range options {
		if option != police {
			legal = append(legal, option)
		}
	}
	return legal
}

func ChooseBotMove(state State, role Role) (Node, bool) {
	if state.Status != game.StatusPlaying || state.Turn != role {
		return "", false
	}

	if role == Police {
		options := Connections(state.Police)
		bestValue := int(^uint(0) >> 1)
		best := make([]Node, 0, len(options))
		for _, option := range options {
			if option == state.Thief {
				return option, true
			}
			value, winning := capturePlies[chaseState{thief: state.Thief, police: option, turn: Thief}]
			if !winning {
				continue
			}
			if value < bestValue {
				bestValue = value
				best = []Node{option}
			} else if value == bestValue {
				best = append(best, option)
			}
		}
		if len(best) > 0 {
			return best[state.Moves%len(best)], true
		}
		if len(options) > 0 {
			return options[state.Moves%len(options)], true
		}
		return "", false
	}

	options := thiefMoves(state.Thief, state.Police)
	if len(options) == 0 {
		return "", false
	}
	bestValue := -1
	best := make([]Node, 0, len(options))
	for _, option := range options {
		value, policeCanForceCapture := capturePlies[chaseState{thief: option, police: state.Police, turn: Police}]
		if !policeCanForceCapture {
			return option, true
		}
		if value > bestValue {
			bestValue = value
			best = []Node{option}
		} else if value == bestValue {
			best = append(best, option)
		}
	}
	return best[state.Moves%len(best)], true
}

func randomDistinctNodes() (Node, Node) {
	first := secureIndex(len(nodes))
	second := secureIndex(len(nodes) - 1)
	if second >= first {
		second++
	}
	return nodes[first], nodes[second]
}

func secureIndex(size int) int {
	value, err := rand.Int(rand.Reader, big.NewInt(int64(size)))
	if err != nil {
		return 0
	}
	return int(value.Int64())
}
