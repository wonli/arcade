package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
)

type Actions struct {
	service *arcade.Service
}

func NewActions(service *arcade.Service) *Actions {
	return &Actions{service: service}
}

func (a *Actions) Register(router ws.IRouter) {
	router.Add("arcade.login", a.login)
	router.Add("room.create", a.createRoom)
	router.Add("room.join", a.joinRoom)
	router.Add("room.state", a.roomState)
	router.Add("game.move", a.move)
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

	c.Send(ws.H{
		"playerId": req.PlayerID,
		"uid":      arcade.GuestUID(req.PlayerID),
	})
}

type roomRequest struct {
	RoomID string `json:"roomId"`
	Name   string `json:"name"`
}

type createRoomRequest struct {
	Game string `json:"game"`
	Name string `json:"name"`
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

	r, err := a.service.Create(req.Game)
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	if err := a.service.Join(r.ID, playerID, displayName(req.Name, playerID)); err != nil {
		c.SendCode(400, err.Error())
		return
	}

	topic := roomTopic(r.ID)
	c.Sub(topic)
	state := r.Snapshot()
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

	r, _ := a.service.Get(req.RoomID)
	state := r.Snapshot()
	c.Send(state)
	c.Pub(roomTopic(req.RoomID), state)
}

func currentPlayer(c *ws.Context) (game.PlayerID, bool) {
	if c == nil || c.Client == nil || c.Client.User == nil {
		return "", false
	}
	uid := c.Client.User.Suid
	if !strings.HasPrefix(uid, "arcade:") {
		return "", false
	}
	playerID := strings.TrimPrefix(uid, "arcade:")
	return game.PlayerID(playerID), playerID != ""
}

func roomTopic(roomID string) string {
	return "room:" + strings.ToUpper(strings.TrimSpace(roomID))
}

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
