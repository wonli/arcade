package drawguess

import (
	"errors"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/wonli/arcade/game"
)

const RoundDuration = 60 * time.Second

type Player struct {
	ID   game.PlayerID `json:"id"`
	Name string        `json:"name"`
}

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Stroke struct {
	Points []Point `json:"points"`
	Color  string  `json:"color"`
	Width  int     `json:"width"`
	Eraser bool    `json:"eraser"`
}

type PublicState struct {
	Status      string                 `json:"status"`
	Round       int                    `json:"round"`
	TotalRounds int                    `json:"totalRounds"`
	DrawerID    game.PlayerID          `json:"drawerId,omitempty"`
	DrawerName  string                 `json:"drawerName,omitempty"`
	Hint        string                 `json:"hint,omitempty"`
	Deadline    time.Time              `json:"deadline,omitempty"`
	Scores      map[game.PlayerID]int  `json:"scores"`
	Guessed     []game.PlayerID        `json:"guessed"`
	Strokes     []Stroke               `json:"strokes"`
	Players     []Player               `json:"players"`
	Winners     []game.PlayerID        `json:"winners,omitempty"`
}

type PrivateState struct {
	PublicState
	Word string `json:"word,omitempty"`
}

type GuessResult struct {
	Correct       bool          `json:"correct"`
	Chat          string        `json:"chat,omitempty"`
	Score         int           `json:"score,omitempty"`
	PlayerID      game.PlayerID `json:"playerId,omitempty"`
	PlayerName    string        `json:"playerName,omitempty"`
	RoundAdvanced bool          `json:"roundAdvanced,omitempty"`
	Finished      bool          `json:"finished,omitempty"`
	Error         string        `json:"error,omitempty"`
}

type Game struct {
	mu sync.Mutex

	players []Player
	words   []string
	now     func() time.Time

	status    string
	round     int
	word      string
	deadline  time.Time
	startedAt time.Time
	scores    map[game.PlayerID]int
	guessed   map[game.PlayerID]bool
	strokes   []Stroke
	winners   []game.PlayerID
}

var allowedColors = map[string]bool{
	"#111111": true,
	"#ffffff": true,
	"#ff5d5d": true,
	"#ffcf5a": true,
	"#c1ff56": true,
	"#65d5ff": true,
	"#a98bff": true,
}

func New(players []Player, words []string, now func() time.Time) *Game {
	if now == nil {
		now = time.Now
	}
	cleanWords := make([]string, 0, len(words))
	for _, word := range words {
		word = strings.TrimSpace(word)
		if word != "" {
			cleanWords = append(cleanWords, word)
		}
	}
	return &Game{
		players: append([]Player(nil), players...),
		words: cleanWords,
		now: now,
		status: "waiting",
		scores: make(map[game.PlayerID]int, len(players)),
		guessed: make(map[game.PlayerID]bool),
	}
}

func (g *Game) Start() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(g.players) < 2 {
		return errors.New("draw and guess requires at least two players")
	}
	if len(g.words) == 0 {
		return errors.New("word list is empty")
	}
	g.status = "playing"
	g.round = 0
	g.startedAt = g.now()
	for _, player := range g.players {
		g.scores[player.ID] = 0
	}
	g.startRoundLocked()
	return nil
}

func (g *Game) Stroke(playerID game.PlayerID, stroke Stroke) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.status != "playing" {
		return errors.New("game is not playing")
	}
	if playerID != g.drawerLocked().ID {
		return errors.New("only drawer can draw")
	}
	if err := validateStroke(stroke); err != nil {
		return err
	}
	copyStroke := cloneStroke(stroke)
	g.strokes = append(g.strokes, copyStroke)
	return nil
}

func (g *Game) Clear(playerID game.PlayerID) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.status != "playing" {
		return errors.New("game is not playing")
	}
	if playerID != g.drawerLocked().ID {
		return errors.New("only drawer can clear")
	}
	g.strokes = nil
	return nil
}

func (g *Game) Guess(playerID game.PlayerID, text string) GuessResult {
	g.mu.Lock()
	defer g.mu.Unlock()

	result := GuessResult{PlayerID: playerID}
	if g.status != "playing" {
		result.Error = "game is not playing"
		return result
	}
	player, ok := g.playerLocked(playerID)
	if !ok {
		result.Error = "player is not in game"
		return result
	}
	result.PlayerName = player.Name
	if playerID == g.drawerLocked().ID {
		result.Error = "drawer cannot guess"
		return result
	}
	if g.guessed[playerID] {
		result.Error = "player already guessed"
		return result
	}

	guess := strings.TrimSpace(text)
	if guess == "" {
		result.Error = "guess is empty"
		return result
	}
	if !strings.EqualFold(guess, g.word) {
		result.Chat = guess
		return result
	}

	remaining := g.deadline.Sub(g.now())
	if remaining < 0 {
		remaining = 0
	}
	ratio := float64(remaining) / float64(RoundDuration)
	if ratio > 1 {
		ratio = 1
	}
	score := 50 + int(math.Floor(50*ratio))
	if score < 50 { score = 50 }
	if score > 100 { score = 100 }

	g.guessed[playerID] = true
	g.scores[playerID] += score
	drawer := g.drawerLocked()
	g.scores[drawer.ID] += 30
	result.Correct = true
	result.Score = score

	if g.allGuessersDoneLocked() {
		result.RoundAdvanced = true
		result.Finished = g.advanceRoundLocked()
	}
	return result
}

func (g *Game) AdvanceIfExpired() bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.status != "playing" || g.now().Before(g.deadline) {
		return false
	}
	g.advanceRoundLocked()
	return true
}

func (g *Game) PublicState() PublicState {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.publicStateLocked()
}

func (g *Game) PrivateState(playerID game.PlayerID) PrivateState {
	g.mu.Lock()
	defer g.mu.Unlock()
	state := PrivateState{PublicState: g.publicStateLocked()}
	if g.status == "playing" && g.drawerLocked().ID == playerID {
		state.Word = g.word
	}
	return state
}

func (g *Game) startRoundLocked() {
	g.word = g.words[g.round%len(g.words)]
	g.deadline = g.now().Add(RoundDuration)
	g.guessed = make(map[game.PlayerID]bool)
	g.strokes = nil
}

func (g *Game) advanceRoundLocked() bool {
	g.round++
	if g.round >= len(g.players) {
		g.finishLocked()
		return true
	}
	g.startRoundLocked()
	return false
}

func (g *Game) finishLocked() {
	g.status = "finished"
	g.deadline = time.Time{}
	g.word = ""
	maxScore := -1
	for _, score := range g.scores {
		if score > maxScore { maxScore = score }
	}
	g.winners = nil
	for _, player := range g.players {
		if g.scores[player.ID] == maxScore {
			g.winners = append(g.winners, player.ID)
		}
	}
}

func (g *Game) publicStateLocked() PublicState {
	state := PublicState{
		Status: g.status,
		Round: g.round + 1,
		TotalRounds: len(g.players),
		Hint: maskWord(g.word),
		Deadline: g.deadline,
		Scores: make(map[game.PlayerID]int, len(g.scores)),
		Players: append([]Player(nil), g.players...),
		Winners: append([]game.PlayerID(nil), g.winners...),
	}
	if g.status == "finished" {
		state.Round = len(g.players)
		state.Hint = ""
	} else if len(g.players) > 0 {
		drawer := g.drawerLocked()
		state.DrawerID = drawer.ID
		state.DrawerName = drawer.Name
	}
	for id, score := range g.scores {
		state.Scores[id] = score
	}
	for id := range g.guessed {
		state.Guessed = append(state.Guessed, id)
	}
	sort.Slice(state.Guessed, func(i, j int) bool { return state.Guessed[i] < state.Guessed[j] })
	state.Strokes = make([]Stroke, len(g.strokes))
	for i, stroke := range g.strokes {
		state.Strokes[i] = cloneStroke(stroke)
	}
	return state
}

func (g *Game) drawerLocked() Player {
	if len(g.players) == 0 {
		return Player{}
	}
	index := g.round
	if index < 0 { index = 0 }
	if index >= len(g.players) { index = len(g.players)-1 }
	return g.players[index]
}

func (g *Game) playerLocked(id game.PlayerID) (Player, bool) {
	for _, player := range g.players {
		if player.ID == id { return player, true }
	}
	return Player{}, false
}

func (g *Game) allGuessersDoneLocked() bool {
	if len(g.players) < 2 { return false }
	drawerID := g.drawerLocked().ID
	for _, player := range g.players {
		if player.ID == drawerID { continue }
		if !g.guessed[player.ID] { return false }
	}
	return true
}

func validateStroke(stroke Stroke) error {
	if len(stroke.Points) < 2 || len(stroke.Points) > 128 {
		return errors.New("stroke must contain 2-128 points")
	}
	if stroke.Width < 2 || stroke.Width > 24 {
		return errors.New("invalid stroke width")
	}
	if !stroke.Eraser && !allowedColors[strings.ToLower(stroke.Color)] {
		return errors.New("invalid stroke color")
	}
	for _, point := range stroke.Points {
		if point.X < 0 || point.X > 1 || point.Y < 0 || point.Y > 1 {
			return errors.New("stroke point is outside canvas")
		}
	}
	return nil
}

func cloneStroke(stroke Stroke) Stroke {
	copyStroke := stroke
	copyStroke.Points = append([]Point(nil), stroke.Points...)
	return copyStroke
}

func maskWord(word string) string {
	if word == "" { return "" }
	var b strings.Builder
	for _, r := range word {
		if r == ' ' || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return b.String()
}
