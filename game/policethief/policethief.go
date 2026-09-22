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

func ChooseBotMove(state State, role Role) (Node, bool) {
	if state.Status != game.StatusPlaying || state.Turn != role {
		return "", false
	}
	from := state.Thief
	target := state.Police
	wantMax := true
	if role == Police {
		from = state.Police
		target = state.Thief
		wantMax = false
	}
	options := Connections(from)
	if role == Thief {
		filtered := options[:0]
		for _, option := range options {
			if option != state.Police {
				filtered = append(filtered, option)
			}
		}
		options = filtered
	}
	if len(options) == 0 {
		return "", false
	}
	best := make([]Node, 0, len(options))
	bestDistance := 0
	for i, option := range options {
		distance := shortestDistance(option, target)
		if i == 0 || (wantMax && distance > bestDistance) || (!wantMax && distance < bestDistance) {
			best = []Node{option}
			bestDistance = distance
			continue
		}
		if distance == bestDistance {
			best = append(best, option)
		}
	}
	return best[state.Moves%len(best)], true
}

func shortestDistance(from, to Node) int {
	if from == to {
		return 0
	}
	seen := map[Node]bool{from: true}
	type item struct {
		node Node
		dist int
	}
	queue := []item{{node: from}}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, next := range graph[current.node] {
			if seen[next] {
				continue
			}
			if next == to {
				return current.dist + 1
			}
			seen[next] = true
			queue = append(queue, item{node: next, dist: current.dist + 1})
		}
	}
	return 1 << 20
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
