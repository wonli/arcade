package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/drawguess"
	"github.com/wonli/arcade/game/snake"
)

type Actions struct{ service *arcade.Service }

func NewActions(service *arcade.Service) *Actions { return &Actions{service: service} }

func (a *Actions) Register(router ws.IRouter) {
	router.Add("arcade.login", a.login)
	router.Add("room.create", a.createRoom)
	router.Add("room.join", a.joinRoom)
	router.Add("room.state", a.roomState)
	router.Add("room.addBot", a.addBot)
	router.Add("room.rematch", a.rematch)
	router.Add("game.move", a.move)
	router.Add("tetris.state", a.tetrisState)
	router.Add("tetris.attack", a.tetrisAttack)
	router.Add("tetris.gameover", a.tetrisGameOver)
	router.Add("tetris.restart", a.tetrisRestart)
	router.Add("snake.start", a.snakeStart)
	router.Add("snake.input", a.snakeInput)
	router.Add("snake.restart", a.snakeRestart)
	router.Add("draw.start", a.drawStart)
	router.Add("draw.stroke", a.drawStroke)
	router.Add("draw.clear", a.drawClear)
	router.Add("draw.guess", a.drawGuess)
	router.Add("draw.privateState", a.drawPrivateState)
}

type loginRequest struct {
	PlayerID  string `json:"playerId"`
	SessionID string `json:"sessionId"`
}

func (a *Actions) login(c *ws.Context) {
	var req loginRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.PlayerID) == "" || strings.TrimSpace(req.SessionID) == "" {
		c.SendCode(400, "invalid guest identity")
		return
	}
	if err := c.Client.Hub.UserLogin(arcade.GuestUID(req.PlayerID), arcade.GuestAppID(req.SessionID), c.Client); err != nil {
		c.SendCode(500, err.Error())
		return
	}
	c.Send(ws.H{"playerId": req.PlayerID, "uid": arcade.GuestUID(req.PlayerID)})
}

type roomRequest struct {
	RoomID     string `json:"roomId"`
	Name       string `json:"name"`
	Difficulty string `json:"difficulty,omitempty"`
	Locale     string `json:"locale,omitempty"`
}
type createRoomRequest struct {
	Game    string `json:"game"`
	Name    string `json:"name"`
	Players int    `json:"players"`
}

func (a *Actions) createRoom(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req createRoomRequest
	if err := c.BindingJson(&req); err != nil {
		c.SendCode(400, "invalid room request")
		return
	}
	if req.Game == "" {
		req.Game = "gomoku"
	}

	var roomValue interface{ Snapshot() map[string]any }
	var roomID string
	var err error
	switch req.Game {
	case "snake":
		r, createErr := a.service.Create("snake", 1, 8)
		err = createErr
		if r != nil {
			roomValue = r
			roomID = r.ID
		}
	case "drawguess":
		r, createErr := a.service.Create("drawguess", 2, 8)
		err = createErr
		if r != nil {
			roomValue = r
			roomID = r.ID
		}
	default:
		if req.Players == 0 {
			req.Players = 2
		}
		r, createErr := a.service.Create(req.Game, req.Players)
		err = createErr
		if r != nil {
			roomValue = r
			roomID = r.ID
		}
	}
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	if err := a.service.Join(roomID, playerID, displayName(req.Name, playerID)); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	topic := roomTopic(roomID)
	c.Sub(topic)
	state := roomValue.Snapshot()
	c.Send(state)
	c.Pub(topic, state)
}

func (a *Actions) joinRoom(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Join(req.RoomID, playerID, displayName(req.Name, playerID)); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	r, _ := a.service.Get(req.RoomID)
	topic := roomTopic(req.RoomID)
	c.Sub(topic)
	state := r.Snapshot()
	c.Send(state)
	c.Pub(topic, state)
}

func (a *Actions) roomState(c *ws.Context) {
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	r, ok := a.service.Get(req.RoomID)
	if !ok {
		c.SendCode(404, "room not found")
		return
	}
	c.Send(r.Snapshot())
}
func (a *Actions) addBot(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.AddBot(req.RoomID, playerID, req.Difficulty); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}
func (a *Actions) rematch(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Rematch(req.RoomID, playerID); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

type moveRequest struct {
	RoomID string          `json:"roomId"`
	Move   json.RawMessage `json:"move"`
}

func (a *Actions) move(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req moveRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || len(req.Move) == 0 {
		c.SendCode(400, "invalid move")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Move(req.RoomID, playerID, req.Move); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

type tetrisStateRequest struct {
	RoomID   string  `json:"roomId"`
	Board    [][]int `json:"board"`
	Score    int     `json:"score"`
	Lines    int     `json:"lines"`
	GameOver bool    `json:"gameOver"`
}
type tetrisAttackRequest struct {
	RoomID string `json:"roomId"`
	Lines  int    `json:"lines"`
}

func (a *Actions) tetrisState(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req tetrisStateRequest
	if err := c.BindingJson(&req); err != nil || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris state")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.state", "playerId": playerID, "board": req.Board, "score": req.Score, "lines": req.Lines, "gameOver": req.GameOver})
	c.Send(ws.H{"ok": true})
}
func (a *Actions) tetrisAttack(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req tetrisAttackRequest
	if err := c.BindingJson(&req); err != nil || req.Lines <= 0 || req.Lines > 8 || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris attack")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.attack", "playerId": playerID, "lines": req.Lines})
	c.Send(ws.H{"ok": true})
}
func (a *Actions) tetrisGameOver(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris game over")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.gameover", "playerId": playerID})
	c.Send(ws.H{"ok": true})
}
func (a *Actions) tetrisRestart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris restart")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.restart", "playerId": playerID})
	c.Send(ws.H{"ok": true})
}

type snakeInputRequest struct {
	RoomID    string          `json:"roomId"`
	Direction snake.Direction `json:"direction"`
}

func (a *Actions) snakeStart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid snake start")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.StartSnake(req.RoomID, playerID, func(roomID string, state snake.State) {
		pubsub.Pub(roomTopic(roomID), ws.H{"type": "snake.state", "state": state})
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}
func (a *Actions) snakeInput(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req snakeInputRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid snake input")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.SnakeInput(req.RoomID, playerID, req.Direction); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}
func (a *Actions) snakeRestart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid snake restart")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.RestartSnake(req.RoomID, playerID, func(roomID string, state snake.State) {
		pubsub.Pub(roomTopic(roomID), ws.H{"type": "snake.state", "state": state})
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

type drawStrokeRequest struct {
	RoomID string           `json:"roomId"`
	Stroke drawguess.Stroke `json:"stroke"`
}
type drawGuessRequest struct {
	RoomID string `json:"roomId"`
	Text   string `json:"text"`
}

func (a *Actions) drawStart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid draw start")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.StartDrawGuessLocale(req.RoomID, playerID, req.Locale, func(roomID string, event map[string]any) { pubsub.Pub(roomTopic(roomID), event) }); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

func (a *Actions) drawStroke(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req drawStrokeRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid draw stroke")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.DrawGuessStroke(req.RoomID, playerID, req.Stroke); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}

func (a *Actions) drawClear(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid draw clear")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.DrawGuessClear(req.RoomID, playerID); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}

func (a *Actions) drawGuess(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req drawGuessRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || strings.TrimSpace(req.Text) == "" {
		c.SendCode(400, "invalid guess")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	result, err := a.service.DrawGuessGuess(req.RoomID, playerID, req.Text)
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(result)
}

func (a *Actions) drawPrivateState(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid private state request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	state, err := a.service.DrawGuessPrivateState(req.RoomID, playerID)
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(state)
}

func (a *Actions) canRelayTetris(roomID string, playerID game.PlayerID) bool {
	roomID = strings.ToUpper(strings.TrimSpace(roomID))
	r, ok := a.service.Get(roomID)
	return ok && r.GameName == "tetris" && r.HasPlayer(playerID)
}
func (a *Actions) sendRoom(c *ws.Context, roomID string) {
	r, ok := a.service.Get(roomID)
	if !ok {
		c.SendCode(404, "room not found")
		return
	}
	state := r.Snapshot()
	c.Send(state)
	c.Pub(roomTopic(roomID), state)
}
func currentPlayer(c *ws.Context) (game.PlayerID, bool) {
	if c == nil || c.Client == nil {
		return "", false
	}
	user, _, loggedIn := c.Client.LoginState()
	if !loggedIn || user == nil {
		return "", false
	}
	uid := user.Suid
	if !strings.HasPrefix(uid, "arcade:") {
		return "", false
	}
	playerID := strings.TrimPrefix(uid, "arcade:")
	return game.PlayerID(playerID), playerID != ""
}
func roomTopic(roomID string) string { return "room:" + strings.ToUpper(strings.TrimSpace(roomID)) }
func displayName(name string, playerID game.PlayerID) string {
	name = strings.TrimSpace(name)
	if name != "" {
		return name
	}
	id := string(playerID)
	if len(id) > 6 {
		id = id[:6]
	}
	return "PLAYER-" + strings.ToUpper(id)
}
