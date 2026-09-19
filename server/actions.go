package server

import (
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
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
